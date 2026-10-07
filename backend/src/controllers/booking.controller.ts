import type { Request, Response } from 'express';
import { Booking, Coupon, Itinerary, Payment, User } from '../models/index.js';
import { renderInvoice } from '../services/invoice.service.js';
import { sendMail } from '../services/mail.service.js';
import { quote } from '../services/pricing.service.js';
import { badRequest, forbidden, notFound } from '../utils/AppError.js';
import { code, DAY_MS, paginate } from '../utils/helpers.js';

export async function getQuote(req: Request, res: Response) {
  const q = await quote(req.body);
  res.json({ nights: q.nights, available: q.available, addons: q.addons, pricing: q.pricing, coupon: q.coupon && { code: q.coupon.code, description: q.coupon.description } });
}

export async function createBookingCore(userId: string, body: Record<string, any>) {
  const q = await quote(body as never);
  const user = await User.findById(userId).lean();
  const booking = await Booking.create({
    reference: code('VYR'),
    user: userId,
    hotel: q.hotel._id,
    room: q.room._id,
    itinerary: body.itineraryId,
    checkIn: q.checkIn,
    checkOut: q.checkOut,
    nights: q.nights,
    guests: body.guests,
    roomsCount: body.roomsCount,
    guestName: body.guestName ?? user?.name,
    guestEmail: body.guestEmail ?? user?.email,
    guestPhone: body.guestPhone ?? user?.phone,
    specialRequests: body.specialRequests,
    addons: q.addons,
    couponCode: q.coupon?.code,
    pricing: q.pricing,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
  });
  if (q.coupon) await Coupon.updateOne({ _id: q.coupon._id }, { $inc: { usedCount: 1 } });
  if (body.itineraryId) await Itinerary.updateOne({ _id: body.itineraryId, user: userId }, { $addToSet: { bookings: booking._id } });
  return booking;
}

export async function createBooking(req: Request, res: Response) {
  const booking = await createBookingCore(req.user!.id, req.body);
  await booking.populate(['hotel', 'room']);
  res.status(201).json({ booking });
}

export async function myBookings(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = { user: req.user!.id };
  const now = new Date();
  if (q.scope === 'upcoming') Object.assign(filter, { checkOut: { $gte: now }, status: { $ne: 'CANCELLED' } });
  if (q.scope === 'past') Object.assign(filter, { $or: [{ checkOut: { $lt: now } }, { status: 'CHECKED_OUT' }] });
  if (q.scope === 'cancelled') filter.status = 'CANCELLED';
  const bookings = await Booking.find(filter).sort({ checkIn: q.scope === 'past' ? -1 : 1 }).populate('hotel', 'name city country images slug rating').populate('room', 'name type');
  res.json({ bookings });
}

async function loadOwned(req: Request) {
  const id = String(req.params.id);
  const booking = await Booking.findOne(/^[a-f\d]{24}$/i.test(id) ? { _id: id } : { reference: id.toUpperCase() })
    .populate('hotel')
    .populate('room')
    .populate('user', 'name email phone');
  if (!booking) throw notFound('Booking');
  const ownerId = String((booking.user as unknown as { _id: unknown })._id);
  if (req.user!.role === 'CUSTOMER' && ownerId !== req.user!.id) throw forbidden();
  return booking;
}

export async function getBooking(req: Request, res: Response) {
  const booking = await loadOwned(req);
  const payments = await Payment.find({ booking: booking._id }).sort({ createdAt: -1 });
  res.json({ booking, payments });
}

export async function cancelBooking(req: Request, res: Response) {
  const booking = await loadOwned(req);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw badRequest(`A ${booking.status.toLowerCase().replace('_', ' ')} booking cannot be cancelled`);
  const hoursToCheckIn = (booking.checkIn.getTime() - Date.now()) / (DAY_MS / 24);
  booking.status = 'CANCELLED';
  booking.cancelledAt = new Date();
  booking.cancelReason = req.body?.reason;
  if (booking.paymentStatus === 'PAID') {
    booking.paymentStatus = 'REFUNDED';
    await Payment.updateMany({ booking: booking._id, status: 'SUCCEEDED' }, { status: 'REFUNDED', note: hoursToCheckIn >= 48 ? 'Full refund' : 'Late cancellation refund' });
  }
  await booking.save();
  void sendMail(booking.guestEmail, `Cancelled · ${booking.reference}`, `Your booking ${booking.reference} has been cancelled.`);
  res.json({ booking });
}

export async function invoice(req: Request, res: Response) {
  const b = await loadOwned(req);
  const pdf = await renderInvoice({
    ...b.toObject(),
    hotel: b.hotel as never,
    room: b.room as never,
  } as never);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="voyara-${b.reference}.pdf"`);
  res.send(pdf);
}

export async function allBookingsFilter(q: Record<string, string>) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.hotel) filter.hotel = q.hotel;
  if (q.q) filter.$or = [{ reference: new RegExp(q.q, 'i') }, { guestName: new RegExp(q.q, 'i') }, { guestEmail: new RegExp(q.q, 'i') }];
  const { page, limit, skip } = paginate(q);
  return { filter, page, limit, skip };
}
