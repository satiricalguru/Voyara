import type { Request, Response } from 'express';
import { Booking, Payment } from '../models/index.js';
import { renderInvoice } from '../services/invoice.service.js';
import { sendMail } from '../services/mail.service.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/AppError.js';
import { code } from '../utils/helpers.js';

/** Simulated payment gateway. Accepts only a non-sensitive last4 hint — never full card data. */
type Method = 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'PAY_AT_HOTEL';

export async function payBooking(userId: string, bookingId: string, method: Method, opts: { last4?: string; simulateFailure?: boolean } = {}) {
  const booking = await Booking.findById(bookingId).populate('hotel').populate('room');
  if (!booking) throw notFound('Booking');
  if (String(booking.user) !== userId) throw forbidden();
  if (booking.status === 'CANCELLED') throw badRequest('This booking was cancelled');
  if (booking.paymentStatus === 'PAID') throw badRequest('This booking is already paid');

  const amount = booking.pricing?.total ?? 0;
  if (method === 'PAY_AT_HOTEL') {
    booking.paymentStatus = 'PAY_AT_HOTEL';
    booking.status = 'CONFIRMED';
    await booking.save();
    const payment = await Payment.create({ booking: booking._id, user: userId, amount, currency: booking.pricing?.currency, method, status: 'PENDING', note: 'To be collected at check-in' });
    return { booking, payment };
  }

  const ok = !opts.simulateFailure;
  const payment = await Payment.create({
    booking: booking._id,
    user: userId,
    amount,
    currency: booking.pricing?.currency,
    method,
    status: ok ? 'SUCCEEDED' : 'FAILED',
    transactionId: code('TXN', 10),
    last4: opts.last4,
  });
  if (!ok) throw new AppError(402, 'The payment was declined by the (simulated) bank. Try another method.', { paymentId: payment.id });
  booking.paymentStatus = 'PAID';
  booking.status = 'CONFIRMED';
  await booking.save();

  void renderInvoice({ ...booking.toObject(), hotel: booking.hotel, room: booking.room } as never)
    .then((pdf) => sendMail(booking.guestEmail, `Confirmed · ${booking.reference}`, `Your stay is confirmed. Reference ${booking.reference}.`, [{ filename: `voyara-${booking.reference}.pdf`, content: pdf }]))
    .catch(() => undefined);
  return { booking, payment };
}

export async function createPayment(req: Request, res: Response) {
  const { bookingId, method, last4, simulateFailure } = req.body;
  const result = await payBooking(req.user!.id, bookingId, method, { last4, simulateFailure });
  res.status(201).json(result);
}

export async function myPayments(req: Request, res: Response) {
  const payments = await Payment.find({ user: req.user!.id }).sort({ createdAt: -1 }).populate({ path: 'booking', select: 'reference hotel checkIn', populate: { path: 'hotel', select: 'name' } });
  res.json({ payments });
}
