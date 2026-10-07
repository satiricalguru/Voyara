import type { Request, Response } from 'express';
import { Destination, Hotel, Room } from '../models/index.js';
import { bookedCount } from '../services/pricing.service.js';
import { badRequest } from '../utils/AppError.js';
import { escapeRegex, nightsBetween } from '../utils/helpers.js';

/** GET /api/search?location&checkIn&checkOut&guests — hotels with live availability for the dates. */
export async function search(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const guests = Math.max(1, Number(q.guests) || 2);
  const checkIn = q.checkIn ? new Date(q.checkIn) : undefined;
  const checkOut = q.checkOut ? new Date(q.checkOut) : undefined;
  if (checkIn && checkOut && checkOut <= checkIn) throw badRequest('Check-out must be after check-in');

  const filter: Record<string, unknown> = { isActive: true };
  if (q.location) {
    const re = new RegExp(escapeRegex(q.location.split(',')[0].trim()), 'i');
    filter.$or = [{ city: re }, { country: re }, { name: re }, { tags: re }, { address: re }];
  }
  if (q.stars) filter.stars = { $gte: Number(q.stars) };
  if (q.category) filter.category = q.category;
  if (q.amenities) filter.amenities = { $all: q.amenities.split(',') };
  const hotels = await Hotel.find(filter).sort({ featured: -1, rating: -1 }).limit(60).lean();

  const results = (
    await Promise.all(
      hotels.map(async (h) => {
        const rooms = await Room.find({ hotel: h._id, isActive: true, capacity: { $gte: Math.min(guests, 4) } }).sort({ pricePerNight: 1 }).lean();
        let roomsLeft = 0;
        let cheapest: number | null = null;
        for (const r of rooms) {
          const left = checkIn && checkOut ? r.quantity - (await bookedCount(r._id, checkIn, checkOut)) : r.quantity;
          if (left > 0) {
            roomsLeft += left;
            cheapest = cheapest === null ? r.pricePerNight : Math.min(cheapest, r.pricePerNight);
          }
        }
        if (!roomsLeft) return null;
        if (q.minPrice && cheapest! < Number(q.minPrice)) return null;
        if (q.maxPrice && cheapest! > Number(q.maxPrice)) return null;
        return { ...h, id: String(h._id), roomsLeft, priceFrom: cheapest, nights: checkIn && checkOut ? nightsBetween(checkIn, checkOut) : null };
      }),
    )
  ).filter(Boolean) as Array<Record<string, any>>;

  if (q.sort === 'price_asc') results.sort((a, b) => a.priceFrom - b.priceFrom);
  if (q.sort === 'price_desc') results.sort((a, b) => b.priceFrom - a.priceFrom);
  if (q.sort === 'rating') results.sort((a, b) => b.rating - a.rating);
  res.json({ items: results, total: results.length });
}

export async function suggest(req: Request, res: Response) {
  const term = String(req.query.q ?? '').trim();
  if (term.length < 1) return res.json({ suggestions: [] });
  const re = new RegExp(`^${escapeRegex(term)}`, 'i');
  const [cities, dests, hotels] = await Promise.all([
    Hotel.distinct('city', { city: re, isActive: true }),
    Destination.find({ name: re }).limit(5).lean(),
    Hotel.find({ name: new RegExp(escapeRegex(term), 'i'), isActive: true }).limit(4).select('name city slug').lean(),
  ]);
  const set = new Map<string, { type: string; label: string; sub?: string; slug?: string }>();
  for (const c of cities) set.set(c.toLowerCase(), { type: 'city', label: c });
  for (const d of dests) set.set(d.name.toLowerCase(), { type: 'city', label: d.name, sub: d.country });
  for (const h of hotels) set.set(`h:${h.slug}`, { type: 'hotel', label: h.name, sub: h.city, slug: h.slug });
  res.json({ suggestions: [...set.values()].slice(0, 8) });
}
