import type { Request, Response } from 'express';
import { Hotel, Review, Room } from '../models/index.js';
import { availabilityForHotel } from '../services/pricing.service.js';
import { notFound } from '../utils/AppError.js';
import { escapeRegex, paginate, slugify } from '../utils/helpers.js';

export async function listHotels(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = paginate(q);
  const filter: Record<string, unknown> = { isActive: true };
  if (q.city) filter.city = new RegExp(`^${escapeRegex(q.city)}`, 'i');
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: re }, { city: re }, { country: re }, { tags: re }];
  }
  if (q.featured === 'true') filter.featured = true;
  if (q.category) filter.category = q.category;
  if (q.stars) filter.stars = { $gte: Number(q.stars) };
  if (q.minPrice || q.maxPrice) filter.priceFrom = { ...(q.minPrice && { $gte: Number(q.minPrice) }), ...(q.maxPrice && { $lte: Number(q.maxPrice) }) };
  if (q.amenities) filter.amenities = { $all: q.amenities.split(',') };
  const sort: Record<string, 1 | -1> =
    q.sort === 'price_asc' ? { priceFrom: 1 } : q.sort === 'price_desc' ? { priceFrom: -1 } : q.sort === 'rating' ? { rating: -1 } : { featured: -1, rating: -1 };
  const [items, total] = await Promise.all([Hotel.find(filter).sort(sort).skip(skip).limit(limit), Hotel.countDocuments(filter)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function getHotel(req: Request, res: Response) {
  const id = String(req.params.id);
  const hotel = await Hotel.findOne(/^[a-f\d]{24}$/i.test(id) ? { _id: id } : { slug: id });
  if (!hotel || (!hotel.isActive && req.user?.role !== 'ADMIN')) throw notFound('Hotel');
  const q = req.query as Record<string, string>;
  const checkIn = q.checkIn ? new Date(q.checkIn) : undefined;
  const checkOut = q.checkOut ? new Date(q.checkOut) : undefined;
  const [rooms, ratingBreakdown, nearby] = await Promise.all([
    availabilityForHotel(String(hotel._id), checkIn, checkOut),
    Review.aggregate([{ $match: { hotel: hotel._id, isHidden: false } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]),
    Hotel.find({ _id: { $ne: hotel._id }, city: hotel.city, isActive: true }).limit(3),
  ]);
  res.json({ hotel, rooms, ratingBreakdown: Object.fromEntries(ratingBreakdown.map((r) => [r._id, r.n])), nearby });
}

export async function availability(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const rooms = await availabilityForHotel(String(req.params.id), q.checkIn ? new Date(q.checkIn) : undefined, q.checkOut ? new Date(q.checkOut) : undefined);
  res.json({ rooms });
}

function toDoc(body: Record<string, unknown>): Record<string, any> {
  const { lat, lng, ...rest } = body;
  return { ...rest, ...(lat !== undefined && lng !== undefined && { location: { type: 'Point' as const, coordinates: [Number(lng), Number(lat)] } }) };
}

export async function createHotel(req: Request, res: Response) {
  const doc = toDoc(req.body);
  let slug = slugify(`${req.body.name}-${req.body.city}`);
  if (await Hotel.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
  const hotel = await Hotel.create({ ...doc, slug });
  res.status(201).json({ hotel });
}

export async function updateHotel(req: Request, res: Response) {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, toDoc(req.body), { new: true, runValidators: true });
  if (!hotel) throw notFound('Hotel');
  res.json({ hotel });
}

export async function deleteHotel(req: Request, res: Response) {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!hotel) throw notFound('Hotel');
  await Room.updateMany({ hotel: hotel._id }, { isActive: false });
  res.json({ message: 'Hotel archived' });
}
