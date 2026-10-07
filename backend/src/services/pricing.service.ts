import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { Addon, Booking, Coupon, Hotel, Room } from '../models/index.js';
import { AppError, badRequest, notFound } from '../utils/AppError.js';
import { nightsBetween, round2, startOfDay } from '../utils/helpers.js';

export interface QuoteInput {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  roomsCount: number;
  addons: { addonId: string; quantity: number }[];
  couponCode?: string;
  excludeBookingId?: string;
}

/** Rooms of a given type that are already booked on any night overlapping [checkIn, checkOut). */
export async function bookedCount(roomId: string | Types.ObjectId, checkIn: Date, checkOut: Date, excludeId?: string) {
  const match: Record<string, unknown> = {
    room: new Types.ObjectId(String(roomId)),
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkIn: { $lt: startOfDay(checkOut) },
    checkOut: { $gt: startOfDay(checkIn) },
  };
  if (excludeId) match._id = { $ne: new Types.ObjectId(excludeId) };
  const [agg] = await Booking.aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: '$roomsCount' } } }]);
  return (agg?.n as number) ?? 0;
}

export async function availabilityForHotel(hotelId: string, checkIn?: Date, checkOut?: Date) {
  const rooms = await Room.find({ hotel: hotelId, isActive: true }).sort({ pricePerNight: 1 }).lean();
  return Promise.all(
    rooms.map(async (r) => {
      const booked = checkIn && checkOut ? await bookedCount(r._id, checkIn, checkOut) : 0;
      return { ...r, id: String(r._id), available: Math.max(0, r.quantity - booked) };
    }),
  );
}

export async function resolveCoupon(code: string | undefined, amount: number) {
  if (!code) return { coupon: null, discount: 0 };
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw badRequest('That coupon code is not valid');
  if (coupon.validFrom && coupon.validFrom > now) throw badRequest('That coupon is not active yet');
  if (coupon.validTo && coupon.validTo < now) throw badRequest('That coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw badRequest('That coupon has been fully redeemed');
  if (amount < (coupon.minAmount ?? 0))
    throw badRequest(`Spend at least ${env.BASE_CURRENCY} ${coupon.minAmount} to use ${coupon.code}`);
  let discount = coupon.type === 'PERCENT' ? (amount * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, amount);
  return { coupon, discount: round2(discount) };
}

export async function quote(input: QuoteInput) {
  const room = await Room.findById(input.roomId).lean();
  if (!room || !room.isActive) throw notFound('Room');
  const hotel = await Hotel.findById(room.hotel).lean();
  if (!hotel || !hotel.isActive) throw notFound('Hotel');

  const checkIn = startOfDay(input.checkIn);
  const checkOut = startOfDay(input.checkOut);
  if (checkIn < startOfDay(new Date())) throw badRequest('Check-in cannot be in the past');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw badRequest('Stay must be at least one night');
  if (nights > 30) throw badRequest('Stays are limited to 30 nights');

  const totalGuests = input.guests.adults + input.guests.children;
  if (totalGuests > room.capacity * input.roomsCount)
    throw badRequest(`${room.name} sleeps ${room.capacity} per room — add another room for ${totalGuests} guests`);

  const booked = await bookedCount(room._id, checkIn, checkOut, input.excludeBookingId);
  if (booked + input.roomsCount > room.quantity)
    throw new AppError(409, `Only ${Math.max(0, room.quantity - booked)} ${room.name} left for those dates`);

  const roomTotal = room.pricePerNight * nights * input.roomsCount;

  const addonDocs = input.addons.length
    ? await Addon.find({ _id: { $in: input.addons.map((a) => a.addonId) }, isActive: true }).lean()
    : [];
  const addons = addonDocs.map((a) => {
    const qty = input.addons.find((x) => x.addonId === String(a._id))?.quantity ?? 1;
    const mult = a.unit === 'PER_NIGHT' ? nights : a.unit === 'PER_GUEST' ? totalGuests : 1;
    return { addon: a._id, name: a.name, unit: a.unit, unitPrice: a.price, quantity: qty, total: round2(a.price * qty * mult) };
  });
  const addonsTotal = round2(addons.reduce((s, a) => s + a.total, 0));
  const { coupon, discount } = await resolveCoupon(input.couponCode, roomTotal + addonsTotal);
  const taxable = Math.max(0, roomTotal + addonsTotal - discount);
  const taxes = round2(taxable * env.TAX_RATE);
  const total = round2(taxable + taxes);

  return {
    hotel,
    room,
    checkIn,
    checkOut,
    nights,
    addons,
    coupon,
    available: room.quantity - booked,
    pricing: {
      roomRate: room.pricePerNight,
      roomTotal: round2(roomTotal),
      addonsTotal,
      discount,
      taxes,
      taxRate: env.TAX_RATE,
      total,
      currency: hotel.currency ?? env.BASE_CURRENCY,
    },
  };
}
