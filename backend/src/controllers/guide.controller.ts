import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { Destination, Hotel, Itinerary, Place, RentalShop } from '../models/index.js';
import { buildItinerary, buildRoute } from '../services/ai/itinerary.builder.js';
import { cacheStats } from '../services/ai/cache.service.js';
import { currencyFor, fxRate, geocode, liveSourcesStatus, pois, reverseGeocode, wikiPois, rentalsNear, staysNear, weather, wikiSummary } from '../services/ai/liveData.service.js';
import { deadline } from '../services/ai/http.js';
import { activeProvider } from '../services/ai/providers.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { escapeRegex, haversineKm, startOfDay, token } from '../utils/helpers.js';

export async function generateItinerary(req: Request, res: Response) {
  const { save, ...input } = req.body;
  let built;
  try {
    built = await buildItinerary(input);
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status) throw new AppError(e.status, e.message);
    throw err;
  }
  if (!save) return res.json({ itinerary: built });
  const doc = await Itinerary.create({ ...built, user: req.user?.id, shareToken: token(9), status: 'SAVED' });
  res.status(201).json({ itinerary: { ...doc.toJSON(), sources: built.sources } });
}

async function resolveDest(name: string) {
  const curated = await Destination.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') }).lean();
  if (curated?.location?.coordinates) {
    return { name: curated.name, country: curated.country, lat: curated.location.coordinates[1], lng: curated.location.coordinates[0], currency: curated.currency, curated };
  }
  const g = await geocode(name);
  if (!g) throw new AppError(422, `We couldn't place “${name}” on the map`);
  return { name: g.name, country: g.country, lat: g.lat, lng: g.lng, currency: currencyFor(g.countryCode), curated: null };
}

const destParam = (req: Request) => {
  const d = String(req.query.destination ?? req.query.name ?? '').trim();
  if (!d) throw badRequest('destination is required');
  return d;
};

export async function destinations(_req: Request, res: Response) {
  const items = await Destination.find().sort({ featured: -1, name: 1 });
  res.json({ destinations: items });
}

export async function destinationOverview(req: Request, res: Response) {
  const d = await resolveDest(destParam(req));
  const [wiki, wx, rate, sights, curatedPlaces] = await Promise.all([
    deadline(wikiSummary(d.name), 8000, null),
    deadline(weather(d.lat, d.lng, startOfDay(new Date()), 7), 10000, []),
    fxRate(env.BASE_CURRENCY, d.currency),
    Promise.all([deadline(pois(d.lat, d.lng), 11000, [], 'overpass pois'), deadline(wikiPois(d.lat, d.lng), 8000, [])]).then(([a, b]) => [...a, ...b]),
    Place.find({ destination: new RegExp(`^${escapeRegex(d.name)}$`, 'i') }).limit(12).lean(),
  ]);
  res.json({
    destination: { name: d.name, country: d.country, lat: d.lat, lng: d.lng, currency: d.currency, image: d.curated?.image, bestMonths: d.curated?.bestMonths, tags: d.curated?.tags, summary: d.curated?.summary },
    overview: wiki,
    weather: wx,
    fx: rate ? { base: env.BASE_CURRENCY, quote: d.currency, rate } : null,
    places: [
      ...curatedPlaces.map((p) => ({ name: p.name, kind: p.category, lat: p.location?.coordinates?.[1], lng: p.location?.coordinates?.[0], description: p.description, image: p.image, indoor: p.indoor, source: 'curated' })),
      ...sights.slice(0, 30),
    ],
  });
}

export async function liveRentals(req: Request, res: Response) {
  const d = await resolveDest(destParam(req));
  const [shops, osm] = await Promise.all([
    RentalShop.find({ isActive: true, $or: [{ destination: new RegExp(`^${escapeRegex(d.name)}$`, 'i') }, { location: { $geoWithin: { $centerSphere: [[d.lng, d.lat], 40 / 6371] } } }] }).lean(),
    deadline(rentalsNear(d.lat, d.lng), 11000, [], 'overpass rentals'),
  ]);
  res.json({
    destination: { name: d.name, lat: d.lat, lng: d.lng },
    bookable: shops.map((s) => ({ ...s, id: String(s._id), distanceKm: s.location?.coordinates ? Math.round(haversineKm(d, { lat: s.location.coordinates[1], lng: s.location.coordinates[0] }) * 10) / 10 : null })),
    live: osm.map((r) => ({ ...r, distanceKm: Math.round(haversineKm(d, r) * 10) / 10 })).sort((a, b) => a.distanceKm - b.distanceKm),
  });
}

export async function liveStays(req: Request, res: Response) {
  const d = await resolveDest(destParam(req));
  const [hotels, osm] = await Promise.all([
    Hotel.find({ isActive: true, $or: [{ city: new RegExp(`^${escapeRegex(d.name)}$`, 'i') }, { location: { $geoWithin: { $centerSphere: [[d.lng, d.lat], 60 / 6371] } } }] }).sort({ rating: -1 }),
    deadline(staysNear(d.lat, d.lng), 11000, [], 'overpass stays'),
  ]);
  res.json({ destination: { name: d.name, lat: d.lat, lng: d.lng }, bookable: hotels, live: osm });
}

export async function livePois(req: Request, res: Response) {
  const d = await resolveDest(destParam(req));
  const kind = req.query.kind ? String(req.query.kind).toUpperCase() : null;
  const list = (await Promise.all([deadline(pois(d.lat, d.lng), 11000, [], 'overpass pois'), deadline(wikiPois(d.lat, d.lng), 8000, [])])).flat();
  res.json({ destination: { name: d.name, lat: d.lat, lng: d.lng }, places: kind ? list.filter((p) => p.kind === kind) : list });
}

export async function liveWeather(req: Request, res: Response) {
  const d = await resolveDest(destParam(req));
  const start = req.query.start ? startOfDay(String(req.query.start)) : startOfDay(new Date());
  const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));
  res.json({ destination: { name: d.name }, weather: await weather(d.lat, d.lng, start, days) });
}

export async function status(_req: Request, res: Response) {
  res.json({ llm: activeProvider() ?? 'rules-engine', sources: liveSourcesStatus(), cache: cacheStats() });
}

export async function generateRoute(req: Request, res: Response) {
  let built;
  try {
    built = await buildRoute(req.body);
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status) throw new AppError(e.status, e.message);
    throw err;
  }
  const doc = await Itinerary.create({ ...built, user: req.user?.id, shareToken: token(9), status: 'SAVED' });
  res.status(201).json({ itinerary: { ...doc.toJSON(), sources: built.sources } });
}

/** Globe click → a named place. Snaps to a curated destination within 150 km, else reverse-geocodes. */
export async function reverse(req: Request, res: Response) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw badRequest('lat and lng are required');
  const curated = await Destination.find().lean();
  const near = curated
    .flatMap((d) => (d.location?.coordinates?.length ? [{ d, dlng: d.location.coordinates[0], dlat: d.location.coordinates[1] }] : []))
    .map((x) => ({ ...x, km: haversineKm({ lat, lng }, { lat: x.dlat, lng: x.dlng }) }))
    .sort((a, b) => a.km - b.km)[0];
  if (near && near.km < 150) {
    return res.json({ place: { name: near.d.name, country: near.d.country, lat: near.dlat, lng: near.dlng, curated: true, image: near.d.image } });
  }
  const g = await deadline(reverseGeocode(lat, lng), 6000, null, 'reverse geocode');
  if (!g) throw new AppError(404, 'Nothing to land on there — try closer to a town or city');
  res.json({ place: { name: g.name, country: g.country, lat: g.lat, lng: g.lng, curated: false } });
}

export async function geocodeSearch(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) throw badRequest('Type at least two letters');
  const curated = await Destination.findOne({ name: new RegExp(`^${escapeRegex(q)}`, 'i') }).lean();
  if (curated?.location?.coordinates) {
    return res.json({ place: { name: curated.name, country: curated.country, lat: curated.location.coordinates[1], lng: curated.location.coordinates[0], curated: true } });
  }
  const g = await deadline(geocode(q), 8000, null, 'geocode');
  if (!g) throw new AppError(404, `Couldn’t find “${q}”`);
  res.json({ place: { name: g.name, country: g.country, lat: g.lat, lng: g.lng, curated: false } });
}
