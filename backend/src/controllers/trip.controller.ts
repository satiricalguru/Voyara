import type { Request, Response } from 'express';
import { Itinerary, RentalBooking, RentalShop, Room, TripDocument } from '../models/index.js';
import { applyWeather } from '../services/ai/itinerary.builder.js';
import { weather } from '../services/ai/liveData.service.js';
import { badRequest, forbidden, notFound } from '../utils/AppError.js';
import { addDays, code, nightsBetween, startOfDay, token } from '../utils/helpers.js';
import { createBookingCore } from './booking.controller.js';
import { payBooking } from './payment.controller.js';

async function loadTrip(req: Request, opts: { write?: boolean } = {}) {
  const trip = await Itinerary.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  const owner = trip.user ? String(trip.user) : null;
  const isOwner = !!req.user && owner === req.user.id;
  const isAdmin = req.user?.role === 'ADMIN';
  if (opts.write) {
    // Unclaimed (anonymous) drafts can be edited by anyone holding the id until claimed.
    if (owner && !isOwner && !isAdmin) throw forbidden();
  } else if (owner && !isOwner && !isAdmin && !trip.isPublic) throw forbidden('This trip is private');
  return { trip, isOwner: isOwner || !owner };
}

export async function myTrips(req: Request, res: Response) {
  const trips = await Itinerary.find({ user: req.user!.id }).sort({ updatedAt: -1 }).select('-days.items.alternative');
  res.json({ trips });
}

export async function community(req: Request, res: Response) {
  const filter: Record<string, unknown> = { isPublic: true };
  if (req.query.destination) filter['destination.name'] = new RegExp(String(req.query.destination), 'i');
  const trips = await Itinerary.find(filter).sort({ likes: -1, updatedAt: -1 }).limit(30).populate('user', 'name homeCity').select('-days.items.alternative');
  res.json({ trips });
}

export async function getTrip(req: Request, res: Response) {
  const { trip, isOwner } = await loadTrip(req);
  await trip.populate([{ path: 'bookings', populate: [{ path: 'hotel', select: 'name slug' }, { path: 'room', select: 'name' }] }, { path: 'rentalBookings', populate: { path: 'shop', select: 'name' } }]);
  const documents = isOwner && req.user ? await TripDocument.find({ itinerary: trip._id, user: req.user.id }).sort({ createdAt: -1 }) : [];
  res.json({ trip, isOwner, documents });
}

export async function sharedTrip(req: Request, res: Response) {
  const trip = await Itinerary.findOne({ shareToken: req.params.token }).populate('user', 'name homeCity');
  if (!trip) throw notFound('Shared trip');
  res.json({ trip });
}

export async function updateTrip(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  Object.assign(trip, req.body);
  await trip.save();
  res.json({ trip });
}

export async function deleteTrip(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  await TripDocument.deleteMany({ itinerary: trip._id });
  await trip.deleteOne();
  res.json({ message: 'Trip deleted' });
}

export async function claimTrip(req: Request, res: Response) {
  const trip = await Itinerary.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.user && String(trip.user) !== req.user!.id) throw forbidden();
  trip.user = req.user!.id as never;
  await trip.save();
  res.json({ trip });
}

export async function shareTrip(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  trip.shareToken ??= token(9);
  if (typeof req.body?.isPublic === 'boolean') trip.isPublic = req.body.isPublic;
  await trip.save();
  res.json({ shareToken: trip.shareToken, isPublic: trip.isPublic });
}

export async function likeTrip(req: Request, res: Response) {
  const trip = await Itinerary.findOneAndUpdate({ _id: req.params.id, isPublic: true }, { $inc: { likes: 1 } }, { new: true });
  if (!trip) throw notFound('Trip');
  res.json({ likes: trip.likes });
}

/** Manually swap one stop with its weather-proof alternative (or back). */
export async function swapItem(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  const day = trip.days.id(req.body.dayId);
  const item = day?.items.id(req.body.itemId);
  if (!day || !item) throw notFound('Itinerary stop');
  if (!item.alternative?.title) throw badRequest('This stop has no alternative');
  const next = applyWeather(item.toObject() as never) as Record<string, unknown>;
  item.set({ ...next, _id: item._id });
  await trip.save();
  res.json({ trip });
}

/** Re-pull the forecast and auto-swap outdoor stops on newly-wet days. */
export async function refreshWeather(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  const dest = trip.destination;
  if (!trip.startDate || dest?.lat == null || dest.lng == null) throw badRequest('Trip has no dates or location');
  const wx = await weather(dest.lat, dest.lng, startOfDay(trip.startDate), trip.days.length);
  let swaps = 0;
  trip.days.forEach((day, i) => {
    const w = wx[i];
    if (!w) return;
    const wasWet = !!day.weather?.wet;
    day.weather = { code: w.code, summary: w.summary, tMax: w.tMax, tMin: w.tMin, precipProb: w.precipProb, wet: w.wet, source: w.source } as never;
    if (w.wet !== wasWet) {
      for (const item of day.items) {
        const outdoorNow = item.indoor === false;
        if (item.alternative?.title && ((w.wet && outdoorNow && !item.swapped) || (!w.wet && item.swapped))) {
          item.set({ ...(applyWeather(item.toObject() as never) as object), _id: item._id });
          swaps++;
        }
      }
    }
  });
  await trip.save();
  res.json({ trip, swaps });
}

/** One-tap: book the chosen stay (+ optional rental) for the trip dates. */
export async function bookTrip(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  if (!trip.user) {
    trip.user = req.user!.id as never;
  }
  const { stayIndex, roomId, includeRental, rentalIndex, couponCode, method, allStops } = req.body;
  if (allStops && trip.stops?.length > 1) return bookRouteStops(req, res, trip);
  const stay = trip.stays[stayIndex];
  if (!stay?.hotel || !stay.bookable) throw badRequest('Pick a Voyara-bookable stay first');
  if (!trip.startDate) throw badRequest('Trip has no start date');

  const checkIn = startOfDay(trip.startDate);
  const checkOut = addDays(checkIn, Math.max(1, trip.days.length - 1));
  const pax = (trip.travelers?.adults ?? 2) + (trip.travelers?.children ?? 0);

  let room = roomId ? await Room.findOne({ _id: roomId, hotel: stay.hotel, isActive: true }) : null;
  if (!room) {
    const rooms = await Room.find({ hotel: stay.hotel, isActive: true }).sort({ pricePerNight: 1 });
    room = rooms.find((r) => r.capacity >= pax) ?? rooms[rooms.length - 1] ?? null;
  }
  if (!room) throw badRequest('That stay has no rooms available');
  const roomsCount = Math.min(5, Math.ceil(pax / room.capacity));

  const booking = await createBookingCore(req.user!.id, {
    roomId: String(room._id),
    checkIn,
    checkOut,
    guests: { adults: trip.travelers?.adults ?? 2, children: trip.travelers?.children ?? 0 },
    roomsCount,
    addons: [],
    couponCode,
    itineraryId: String(trip._id),
  });
  const paid = await payBooking(req.user!.id, String(booking._id), method);

  let rentalBooking = null;
  if (includeRental) {
    const rentals = trip.rentals.filter((r) => r.bookable && r.shop);
    const pick = rentalIndex != null ? trip.rentals[rentalIndex] : rentals[0];
    if (pick?.shop && pick.bookable) {
      rentalBooking = await createRental(req.user!.id, { shopId: String(pick.shop), vehicleType: pick.vehicleType!, quantity: Math.max(1, Math.ceil(pax / 2)), startDate: checkIn, endDate: checkOut, itineraryId: String(trip._id) });
    }
  }

  trip.status = 'BOOKED';
  await trip.save();
  res.status(201).json({ booking: paid.booking, payment: paid.payment, rentalBooking, trip });
}

/* ── Rentals ── */

export async function createRental(userId: string, b: { shopId: string; vehicleType: string; quantity: number; startDate: Date; endDate: Date; itineraryId?: string }) {
  const shop = await RentalShop.findById(b.shopId);
  if (!shop || !shop.isActive) throw notFound('Rental shop');
  const v = shop.vehicles.find((x) => x.type === b.vehicleType);
  if (!v) throw badRequest(`${shop.name} does not rent ${b.vehicleType.toLowerCase()}s`);
  const days = Math.max(1, nightsBetween(b.startDate, b.endDate));
  const overlapping = await RentalBooking.aggregate([
    { $match: { shop: shop._id, vehicleType: v.type, status: 'CONFIRMED', startDate: { $lt: b.endDate }, endDate: { $gt: b.startDate } } },
    { $group: { _id: null, n: { $sum: '$quantity' } } },
  ]);
  if ((overlapping[0]?.n ?? 0) + b.quantity > (v.available ?? 0)) throw badRequest(`Not enough ${v.type.toLowerCase()}s left for those dates`);
  const rb = await RentalBooking.create({
    reference: code('RNT'),
    user: userId,
    shop: shop._id,
    itinerary: b.itineraryId,
    vehicleType: v.type,
    model: v.model,
    quantity: b.quantity,
    startDate: startOfDay(b.startDate),
    endDate: startOfDay(b.endDate),
    days,
    pricePerDay: v.pricePerDay,
    total: v.pricePerDay * days * b.quantity,
  });
  if (b.itineraryId) await Itinerary.updateOne({ _id: b.itineraryId }, { $addToSet: { rentalBookings: rb._id } });
  return rb.populate('shop', 'name address phone destination');
}

export async function rentalShops(req: Request, res: Response) {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.destination) filter.destination = new RegExp(String(req.query.destination), 'i');
  if (req.query.type) filter['vehicles.type'] = String(req.query.type).toUpperCase();
  res.json({ shops: await RentalShop.find(filter).sort({ rating: -1 }) });
}

export async function bookRental(req: Request, res: Response) {
  res.status(201).json({ rentalBooking: await createRental(req.user!.id, req.body) });
}

export async function myRentals(req: Request, res: Response) {
  res.json({ rentals: await RentalBooking.find({ user: req.user!.id }).sort({ startDate: -1 }).populate('shop', 'name address destination phone image') });
}

export async function cancelRental(req: Request, res: Response) {
  const rb = await RentalBooking.findOne({ _id: req.params.id, user: req.user!.id });
  if (!rb) throw notFound('Rental');
  if (rb.status !== 'CONFIRMED') throw badRequest('This rental cannot be cancelled');
  rb.status = 'CANCELLED';
  await rb.save();
  res.json({ rentalBooking: rb });
}

/* ── Trip documents ── */

export async function addDocument(req: Request, res: Response) {
  const { trip } = await loadTrip(req, { write: true });
  if (!req.file) throw badRequest('Attach a file');
  const base = `${req.protocol}://${req.get('host')}`;
  const doc = await TripDocument.create({
    user: req.user!.id,
    itinerary: trip._id,
    name: req.body.name || req.file.originalname,
    kind: req.body.kind ?? 'OTHER',
    url: `${base}/uploads/${req.file.filename}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  res.status(201).json({ document: doc });
}

export async function deleteDocument(req: Request, res: Response) {
  const doc = await TripDocument.findOneAndDelete({ _id: req.params.docId, user: req.user!.id });
  if (!doc) throw notFound('Document');
  res.json({ message: 'Document removed' });
}

/** For multi-city routes: the best bookable stay in each city, for exactly that city's nights. */
async function bookRouteStops(req: Request, res: Response, trip: InstanceType<typeof Itinerary>) {
  const { couponCode, method } = req.body;
  const pax = (trip.travelers?.adults ?? 2) + (trip.travelers?.children ?? 0);
  const booked = [];
  const skipped: string[] = [];
  for (const [i, stop] of trip.stops.entries()) {
    const stay = trip.stays.find((s) => s.stopIndex === i && s.bookable && s.hotel);
    if (!stay || !stop.startDate) {
      skipped.push(stop.name ?? `Stop ${i + 1}`);
      continue;
    }
    const rooms = await Room.find({ hotel: stay.hotel, isActive: true }).sort({ pricePerNight: 1 });
    const room = rooms.find((r) => r.capacity >= pax) ?? rooms[rooms.length - 1];
    if (!room) {
      skipped.push(stop.name ?? `Stop ${i + 1}`);
      continue;
    }
    const checkIn = startOfDay(stop.startDate);
    const b = await createBookingCore(req.user!.id, {
      roomId: String(room._id),
      checkIn,
      checkOut: addDays(checkIn, Math.max(1, stop.days ?? 1)),
      guests: { adults: trip.travelers?.adults ?? 2, children: trip.travelers?.children ?? 0 },
      roomsCount: Math.min(5, Math.ceil(pax / room.capacity)),
      addons: [],
      couponCode: booked.length === 0 ? couponCode : undefined,
      itineraryId: String(trip._id),
    });
    booked.push((await payBooking(req.user!.id, String(b._id), method)).booking);
  }
  if (!booked.length) throw badRequest('None of these cities has a Voyara-bookable stay yet');
  trip.status = 'BOOKED';
  await trip.save();
  res.status(201).json({ booking: booked[0], bookings: booked, skipped, rentalBooking: null, trip });
}
