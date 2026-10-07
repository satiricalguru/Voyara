import type { Request, Response } from 'express';
import { Booking, Hotel, Itinerary, Newsletter, Payment, RentalBooking, Review, Room, User } from '../models/index.js';
import { notFound } from '../utils/AppError.js';
import { escapeRegex, paginate } from '../utils/helpers.js';
import { allBookingsFilter } from './booking.controller.js';
import { recomputeRating } from './review.controller.js';

export async function stats(_req: Request, res: Response) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = new Date(now.getTime() - 180 * 86_400_000);
  const [users, hotels, rooms, bookings, active, revenueAgg, monthRevenue, byStatus, monthly, topHotels, itineraries, rentals, subscribers, recent] = await Promise.all([
    User.countDocuments(),
    Hotel.countDocuments({ isActive: true }),
    Room.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, n: { $sum: '$quantity' } } }]),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'CHECKED_IN' }),
    Payment.aggregate([{ $match: { status: 'SUCCEEDED' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'SUCCEEDED', createdAt: { $gte: monthStart } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, bookings: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$hotel', bookings: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $unwind: '$hotel' },
      { $project: { bookings: 1, revenue: 1, name: '$hotel.name', city: '$hotel.city' } },
    ]),
    Itinerary.countDocuments(),
    RentalBooking.countDocuments(),
    Newsletter.countDocuments({ isActive: true }),
    Booking.find().sort({ createdAt: -1 }).limit(6).populate('hotel', 'name city').populate('user', 'name'),
  ]);
  const totalRooms = rooms[0]?.n ?? 0;
  const occupied = await Booking.aggregate([
    { $match: { status: { $in: ['CONFIRMED', 'CHECKED_IN'] }, checkIn: { $lte: now }, checkOut: { $gt: now } } },
    { $group: { _id: null, n: { $sum: '$roomsCount' } } },
  ]);
  res.json({
    totals: {
      users, hotels, rooms: totalRooms, bookings, checkedIn: active, itineraries, rentals, subscribers,
      revenue: revenueAgg[0]?.sum ?? 0,
      revenueThisMonth: monthRevenue[0]?.sum ?? 0,
      occupancy: totalRooms ? Math.round(((occupied[0]?.n ?? 0) / totalRooms) * 100) : 0,
    },
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    monthly,
    topHotels,
    recent,
  });
}

export async function bookings(req: Request, res: Response) {
  const { filter, page, limit, skip } = await allBookingsFilter(req.query as Record<string, string>);
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('hotel', 'name city').populate('room', 'name').populate('user', 'name email'),
    Booking.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function users(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = paginate(q);
  const filter: Record<string, unknown> = {};
  if (q.role) filter.role = q.role;
  if (q.q) filter.$or = [{ name: new RegExp(escapeRegex(q.q), 'i') }, { email: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function updateUser(req: Request, res: Response) {
  const patch: Record<string, unknown> = {};
  if (req.body.role) patch.role = req.body.role;
  if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
  const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!user) throw notFound('User');
  res.json({ user });
}

export async function payments(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = paginate(q);
  const filter: Record<string, unknown> = q.status ? { status: q.status } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email').populate('booking', 'reference'),
    Payment.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function reviews(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = paginate(q);
  const filter: Record<string, unknown> = q.hidden ? { isHidden: q.hidden === 'true' } : {};
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email').populate('hotel', 'name city'),
    Review.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function moderateReview(req: Request, res: Response) {
  const review = await Review.findByIdAndUpdate(req.params.id, { isHidden: !!req.body.isHidden }, { new: true });
  if (!review) throw notFound('Review');
  await recomputeRating(review.hotel);
  res.json({ review });
}
