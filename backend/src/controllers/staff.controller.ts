import type { Request, Response } from 'express';
import { Booking, Payment } from '../models/index.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { escapeRegex, startOfDay, addDays } from '../utils/helpers.js';

export async function staffBookings(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  const day = q.date ? startOfDay(q.date) : startOfDay(new Date());
  if (q.view === 'arrivals') Object.assign(filter, { checkIn: { $gte: day, $lt: addDays(day, 1) }, status: { $in: ['CONFIRMED', 'PENDING'] } });
  else if (q.view === 'departures') Object.assign(filter, { checkOut: { $gte: day, $lt: addDays(day, 1) }, status: 'CHECKED_IN' });
  else if (q.view === 'in-house') filter.status = 'CHECKED_IN';
  else filter.status = { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] };
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ reference: re }, { guestName: re }, { guestEmail: re }];
  }
  const bookings = await Booking.find(filter).sort({ checkIn: 1 }).limit(200).populate('hotel', 'name city').populate('room', 'name');
  const [arrivals, departures, inHouse] = await Promise.all([
    Booking.countDocuments({ checkIn: { $gte: day, $lt: addDays(day, 1) }, status: { $in: ['CONFIRMED', 'PENDING'] } }),
    Booking.countDocuments({ checkOut: { $gte: day, $lt: addDays(day, 1) }, status: 'CHECKED_IN' }),
    Booking.countDocuments({ status: 'CHECKED_IN' }),
  ]);
  res.json({ bookings, counts: { arrivals, departures, inHouse } });
}

export async function checkIn(req: Request, res: Response) {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) throw notFound('Booking');
  if (booking.status !== 'CONFIRMED') throw badRequest(`Only confirmed bookings can be checked in (this one is ${booking.status.toLowerCase()})`);
  if (startOfDay(booking.checkIn) > addDays(startOfDay(new Date()), 0)) throw badRequest('Check-in opens on the arrival date');
  booking.status = 'CHECKED_IN';
  booking.checkedInAt = new Date();
  booking.handledBy = req.user!.id as never;
  await booking.save();
  res.json({ booking });
}

export async function checkOut(req: Request, res: Response) {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) throw notFound('Booking');
  if (booking.status !== 'CHECKED_IN') throw badRequest('Only checked-in guests can be checked out');
  if (booking.paymentStatus === 'PAY_AT_HOTEL') {
    booking.paymentStatus = 'PAID';
    await Payment.updateMany({ booking: booking._id, method: 'PAY_AT_HOTEL', status: 'PENDING' }, { status: 'SUCCEEDED', note: 'Collected at front desk' });
  }
  booking.status = 'CHECKED_OUT';
  booking.checkedOutAt = new Date();
  booking.handledBy = req.user!.id as never;
  await booking.save();
  res.json({ booking });
}
