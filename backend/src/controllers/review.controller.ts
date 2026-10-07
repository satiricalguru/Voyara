import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Booking, Hotel, Review } from '../models/index.js';
import { badRequest, forbidden, notFound } from '../utils/AppError.js';
import { paginate } from '../utils/helpers.js';

export async function recomputeRating(hotelId: Types.ObjectId | string) {
  const [agg] = await Review.aggregate([
    { $match: { hotel: new Types.ObjectId(String(hotelId)), isHidden: false } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Hotel.updateOne({ _id: hotelId }, { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg?.n ?? 0 });
}

export async function hotelReviews(req: Request, res: Response) {
  const { page, limit, skip } = paginate(req.query as Record<string, string>);
  const filter = { hotel: req.params.hotelId, isHidden: false };
  const sort: Record<string, 1 | -1> = req.query.sort === 'lowest' ? { rating: 1 } : req.query.sort === 'highest' ? { rating: -1 } : { createdAt: -1 };
  const [reviews, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name avatar homeCity'),
    Review.countDocuments(filter),
  ]);
  let canReview = false;
  if (req.user) {
    const [stayed, already] = await Promise.all([
      Booking.exists({ user: req.user.id, hotel: req.params.hotelId, status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } }),
      Review.exists({ user: req.user.id, hotel: req.params.hotelId }),
    ]);
    canReview = !!stayed && !already;
  }
  res.json({ reviews, total, page, pages: Math.ceil(total / limit), canReview });
}

export async function createReview(req: Request, res: Response) {
  const { hotelId, ...rest } = req.body;
  const booking = await Booking.findOne({ user: req.user!.id, hotel: hotelId, status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } }).sort({ checkIn: -1 });
  if (!booking) throw badRequest('You can review a stay once you have a confirmed booking there');
  if (await Review.exists({ user: req.user!.id, hotel: hotelId })) throw badRequest('You have already reviewed this stay');
  const review = await Review.create({ ...rest, hotel: hotelId, user: req.user!.id, booking: booking._id });
  await recomputeRating(hotelId);
  await review.populate('user', 'name avatar homeCity');
  res.status(201).json({ review });
}

export async function deleteReview(req: Request, res: Response) {
  const review = await Review.findById(req.params.id);
  if (!review) throw notFound('Review');
  if (req.user!.role !== 'ADMIN' && String(review.user) !== req.user!.id) throw forbidden();
  await review.deleteOne();
  await recomputeRating(review.hotel);
  res.json({ message: 'Review deleted' });
}

export async function latestReviews(_req: Request, res: Response) {
  const reviews = await Review.find({ isHidden: false, rating: { $gte: 4 } }).sort({ createdAt: -1 }).limit(12).populate('user', 'name homeCity').populate('hotel', 'name city slug images');
  res.json({ reviews });
}
