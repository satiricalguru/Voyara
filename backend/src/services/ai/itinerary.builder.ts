import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { Destination, Hotel, Place, RentalShop } from '../../models/index.js';
import { addDays, escapeRegex, haversineKm, startOfDay } from '../../utils/helpers.js';
import {
  currencyFor, fxRate, geocode, googlePlaces, pois, wikiPois, rentalsNear, staysNear, travelSnippets, weather, wikiSummary,
  type DayWeather, type GeoPoint, type LivePoi, type PoiKind,
} from './liveData.service.js';
import { deadline } from './http.js';
import { activeProvider, llmJson } from './providers.js';

export type Budget = 'SHOESTRING' | 'MODERATE' | 'LUXURY';
export type Pace = 'relaxed' | 'balanced' | 'packed';

export interface TripIntent {
  destination: string;
  days: number;
  startDate: Date;
  travelers: { adults: number; children: number };
  budget: Budget;
  pace: Pace;
  interests: string[];
}

export interface BuildRequest {
  prompt?: string;
  destination?: string;
  /** Known coordinates (e.g. a globe click) — skips the geocoder. */
  coords?: { lat: number; lng: number; country?: string };
  startDate?: Date;
  days?: number;
  travelers?: { adults: number; children: number };
  budget?: Budget;
  pace?: Pace;
  interests?: string[];
}

/* ────────────────────────── 1 · Intent parsing ────────────────────────── */

const INTEREST_WORDS: Record<string, RegExp> = {
  food: /\b(food|eat|cuisine|street food|foodie|restaurants?|dining|culinary)\b/i,
  beaches: /\b(beach(es)?|sea|coast|surf|sun ?bath|island)\b/i,
  nature: /\b(nature|hik(e|ing)|trek(king)?|mountains?|waterfalls?|forest|outdoors?|parks?|lakes?)\b/i,
  history: /\b(history|historic|heritage|forts?|palaces?|ruins|monuments?|architecture)\b/i,
  culture: /\b(culture|art|galler(y|ies)|museums?|theatre|music|local life)\b/i,
  nightlife: /\b(nightlife|party|bars?|clubs?|drinks|cocktails)\b/i,
  spiritual: /\b(temples?|spiritual|yoga|meditation|shrines?|churches?|monaster(y|ies))\b/i,
  shopping: /\b(shop(ping)?|markets?|bazaars?|souvenirs?)\b/i,
  adventure: /\b(adventure|paraglid(e|ing)|rafting|scuba|div(e|ing)|ski(ing)?|bungee|safari)\b/i,
  cafes: /\b(caf(e|é)s?|coffee|brunch)\b/i,
  photography: /\b(photo(graphy|s)?|instagram|sunsets?|views?|viewpoints?)\b/i,
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1 };
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORD_NUM[s.toLowerCase()] ?? NaN);

export async function parseIntent(prompt: string): Promise<Partial<TripIntent>> {
  const p = ` ${prompt} `;
  const out: Partial<TripIntent> = {};

  const d = p.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:[a-z]+[\s-]+){0,2}?(days?|nights?)\b/i);
  if (d) out.days = num(d[1]) + (/night/i.test(d[2]) ? 1 : 0);
  else if (/\b(a|one) week\b/i.test(p)) out.days = 7;
  else if (/\b(\d|two) weeks?\b/i.test(p)) out.days = 14;
  else if (/\blong weekend\b/i.test(p)) out.days = 3;
  else if (/\bweekend\b/i.test(p)) out.days = 2;

  if (/\b(budget|cheap|backpack(ing|er)?|shoestring|hostel|affordable|student)\b/i.test(p)) out.budget = 'SHOESTRING';
  else if (/\b(luxury|luxurious|splurge|5[- ]star|five[- ]star|honeymoon|premium|lavish)\b/i.test(p)) out.budget = 'LUXURY';

  if (/\b(relax(ed|ing)?|slow|chill|easy|lazy|unwind)\b/i.test(p)) out.pace = 'relaxed';
  else if (/\b(packed|action|fast|intense|see everything|busy|jam)\b/i.test(p)) out.pace = 'packed';

  const interests = Object.entries(INTEREST_WORDS).filter(([, re]) => re.test(p)).map(([k]) => k);
  if (interests.length) out.interests = interests;

  if (/\bsolo|alone|by myself\b/i.test(p)) out.travelers = { adults: 1, children: 0 };
  else if (/\b(wife|husband|partner|girlfriend|boyfriend|couple|honeymoon|spouse)\b/i.test(p)) out.travelers = { adults: 2, children: 0 };
  const fam = p.match(/\bfamily of (\d+|two|three|four|five|six)\b/i);
  if (fam) out.travelers = { adults: 2, children: Math.max(0, num(fam[1]) - 2) };
  const kids = p.match(/\b(\d|one|two|three|four) (kids|children)\b/i);
  if (kids) out.travelers = { adults: out.travelers?.adults ?? 2, children: num(kids[1]) };
  const friends = p.match(/\b(\d+|two|three|four|five|six) (friends|people|of us|adults|pax)\b/i);
  if (friends) out.travelers = { adults: num(friends[1]) + (/friends/i.test(friends[2]) ? 1 : 0), children: out.travelers?.children ?? 0 };

  const isoD = p.match(/\b(20\d\d-\d\d-\d\d)\b/);
  const md = p.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})[a-z]*\\b|\\b(${MONTHS.join('|')})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  const monthOnly = p.match(new RegExp(`\\b(?:in|during|this|next)\\s+(${MONTHS.join('|')})[a-z]*\\b`, 'i'));
  const now = startOfDay(new Date());
  const future = (m: number, day: number) => {
    let y = now.getUTCFullYear();
    let dt = new Date(Date.UTC(y, m, day));
    if (dt < now) dt = new Date(Date.UTC(++y, m, day));
    return dt;
  };
  if (isoD) out.startDate = new Date(isoD[1]);
  else if (md) {
    const day = Number(md[1] ?? md[4]);
    const mon = MONTHS.indexOf((md[2] ?? md[3]).slice(0, 3).toLowerCase());
    out.startDate = future(mon, day);
  } else if (monthOnly) out.startDate = future(MONTHS.indexOf(monthOnly[1].slice(0, 3).toLowerCase()), 10);
  else if (/\btomorrow\b/i.test(p)) out.startDate = addDays(now, 1);
  else if (/\bnext week\b/i.test(p)) out.startDate = addDays(now, 7);
  else if (/\bthis weekend\b/i.test(p)) out.startDate = addDays(now, (6 - now.getUTCDay() + 7) % 7 || 7);
  else if (/\bnext month\b/i.test(p)) out.startDate = addDays(now, 30);

  // Destination: known names first, then "to/in/visit X" phrasing.
  const known = await Destination.find().select('name').lean();
  const hit = known.map((k) => k.name).sort((a, b) => b.length - a.length).find((n) => new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(p));
  if (hit) out.destination = hit;
  else {
    const m = p.match(/\b(?:to|in|visit(?:ing)?|explore|exploring|around|trip of|holiday in)\s+([A-Z][\p{L}'’.-]+(?:[\s,]+[A-Z][\p{L}'’.-]+){0,3})/u);
    if (m) out.destination = m[1].replace(/[,.]+$/, '').trim();
  }
  return out;
}

/* ────────────────────────── 2 · Candidate places ────────────────────────── */

interface Cand {
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  indoor: boolean;
  description?: string;
  rating: number;
  durationMins: number;
  priceLevel: number;
  source: string;
}

const KIND_INTEREST: Record<string, PoiKind[]> = {
  food: ['FOOD', 'CAFE'], beaches: ['BEACH'], nature: ['NATURE', 'VIEWPOINT'], history: ['SIGHT', 'TEMPLE', 'MUSEUM'],
  culture: ['MUSEUM', 'ACTIVITY'], nightlife: ['NIGHTLIFE'], spiritual: ['TEMPLE'], shopping: ['SHOPPING'],
  adventure: ['NATURE', 'ACTIVITY'], cafes: ['CAFE'], photography: ['VIEWPOINT', 'BEACH', 'SIGHT'],
};

const DURATION: Partial<Record<PoiKind, number>> = { MUSEUM: 120, SIGHT: 100, NATURE: 150, BEACH: 150, VIEWPOINT: 60, TEMPLE: 75, SHOPPING: 90, ACTIVITY: 120, FOOD: 75, CAFE: 45, NIGHTLIFE: 120 };

async function gatherPlaces(destName: string, lat: number, lng: number): Promise<Cand[]> {
  const [osm, wiki, curated, google] = await Promise.all([
    deadline(pois(lat, lng), LIVE_BUDGET_MS, [], 'overpass pois'),
    deadline(wikiPois(lat, lng), 8000, [], 'wikipedia pois'),
    Place.find({ destination: new RegExp(`^${escapeRegex(destName)}$`, 'i') }).lean(),
    googlePlaces(`top attractions and restaurants in ${destName}`),
  ]);
  const list: Cand[] = [];
  const seen = new Set<string>();
  const push = (c: Cand) => {
    const k = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(k)) return;
    seen.add(k);
    list.push(c);
  };
  for (const c of curated) {
    const [plng, plat] = c.location?.coordinates ?? [lng, lat];
    push({ name: c.name, kind: c.category as PoiKind, lat: plat, lng: plng, indoor: !!c.indoor, description: c.description ?? undefined, rating: (c.rating ?? 4.5) + 0.3, durationMins: c.durationMins ?? 90, priceLevel: c.priceLevel ?? 1, source: 'curated' });
  }
  for (const g of google as LivePoi[]) push({ ...g, rating: g.rating ?? 4.3, durationMins: DURATION[g.kind] ?? 90, priceLevel: 1, source: g.source });
  for (const w of wiki) push({ ...w, rating: w.rating ?? 4, durationMins: DURATION[w.kind] ?? 90, priceLevel: 1, source: w.source });
  for (const o of osm) push({ ...o, rating: o.rating ?? 4, durationMins: DURATION[o.kind] ?? 90, priceLevel: o.kind === 'FOOD' ? 2 : 1, source: o.source });
  return list;
}

/* ────────────────────────── 3 · Day planning ────────────────────────── */

/** Max wait for any single live source before the curated fallback takes over. */
const LIVE_BUDGET_MS = 11000;

const SLOT_TIME = { MORNING: '09:00', LUNCH: '13:00', AFTERNOON: '14:30', EVENING: '17:30', DINNER: '20:00' } as const;
type Slot = keyof typeof SLOT_TIME;

const FILLERS: Record<Slot, { title: string; kind: PoiKind; indoor: boolean; description: string }[]> = {
  MORNING: [
    { title: 'Old-quarter walking loop', kind: 'SIGHT', indoor: false, description: 'Slow loop through the historic centre — side streets, doorways, morning light.' },
    { title: 'Sunrise viewpoint & breakfast', kind: 'VIEWPOINT', indoor: false, description: 'Early start for the softest light, then a long local breakfast.' },
  ],
  AFTERNOON: [
    { title: 'Neighbourhood wander', kind: 'SIGHT', indoor: false, description: 'Pick a quarter you have not seen yet and follow your nose.' },
    { title: 'Local market browse', kind: 'SHOPPING', indoor: false, description: 'Produce, crafts and snacks — the best place to read a city.' },
  ],
  EVENING: [
    { title: 'Golden-hour stroll', kind: 'VIEWPOINT', indoor: false, description: 'Find water or height for the last hour of light.' },
    { title: 'Live music or a show', kind: 'ACTIVITY', indoor: true, description: 'Ask the front desk what is on tonight.' },
  ],
  LUNCH: [{ title: 'Long local lunch', kind: 'FOOD', indoor: true, description: 'Where the locals queue — order the house special.' }],
  DINNER: [{ title: 'Dinner at a neighbourhood favourite', kind: 'FOOD', indoor: true, description: 'Book ahead on weekends.' }],
};

const INDOOR_FILLERS = [
  { title: 'Museum hour', kind: 'MUSEUM' as PoiKind, description: 'Duck into the nearest museum or gallery while the weather passes.' },
  { title: 'Café & cookbook stop', kind: 'CAFE' as PoiKind, description: 'Warm drinks and a slow read until the sky clears.' },
  { title: 'Covered market & cooking class', kind: 'ACTIVITY' as PoiKind, description: 'Hands-on, roofed, and delicious.' },
];

const BUDGET_COST: Record<Budget, { meal: number; activity: number; transport: number; stayFallback: number }> = {
  SHOESTRING: { meal: 350, activity: 250, transport: 400, stayFallback: 1800 },
  MODERATE: { meal: 900, activity: 700, transport: 1200, stayFallback: 6500 },
  LUXURY: { meal: 2800, activity: 2200, transport: 3500, stayFallback: 18000 },
};

/** Nearest-neighbour ordering so each day is geographically compact. */
function routeOrder<T extends { lat: number; lng: number }>(items: T[], start: { lat: number; lng: number }): T[] {
  const left = [...items];
  const out: T[] = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((c, i) => {
      const d = haversineKm(cur, c);
      if (d < bd) { bd = d; bi = i; }
    });
    cur = left[bi];
    out.push(left.splice(bi, 1)[0]);
  }
  return out;
}

function themeFor(items: { kind: PoiKind }[], wet: boolean): string {
  const kinds = items.map((i) => i.kind);
  const has = (k: PoiKind) => kinds.includes(k);
  if (wet) return 'Rain-proof: galleries, cafés & covered markets';
  if (has('BEACH')) return 'Sand, salt & sunset';
  if (has('TEMPLE') && has('SIGHT')) return 'Sacred sites & old stones';
  if (has('NATURE') || has('VIEWPOINT')) return 'Green spaces & big views';
  if (has('MUSEUM')) return 'Art, archives & the old town';
  if (has('SHOPPING')) return 'Markets, makers & street food';
  return 'Slow wander through the centre';
}

const placeRef = (c: { name: string; lat: number; lng: number }) => ({ name: c.name, lat: c.lat, lng: c.lng });

export function applyWeather<T extends { indoor?: boolean | null; swapped?: boolean | null; title: string; category?: string | null; description?: string | null; place?: unknown; alternative?: { title?: string | null; category?: string | null; description?: string | null; place?: unknown; indoor?: boolean | null } | null }>(item: T): T {
  if (!item.alternative?.title) return item;
  const a = item.alternative;
  const swapped = {
    ...item,
    title: a.title!,
    category: a.category,
    description: a.description,
    place: a.place,
    indoor: a.indoor,
    swapped: !item.swapped,
    alternative: { title: item.title, category: item.category, description: item.description, place: item.place, indoor: item.indoor },
  };
  return swapped as T;
}

export async function buildItinerary(req: BuildRequest) {
  const parsed = req.prompt ? await parseIntent(req.prompt) : {};
  const provider = activeProvider();

  // Let the LLM fill gaps in intent extraction when a key is configured.
  if (req.prompt && provider && (!parsed.destination || !parsed.days)) {
    const llm = await llmJson<Partial<{ destination: string; days: number; interests: string[]; budget: Budget; pace: Pace }>>(
      'Extract travel intent. Reply ONLY JSON: {"destination": string|null, "days": number|null, "interests": string[], "budget": "SHOESTRING"|"MODERATE"|"LUXURY"|null, "pace": "relaxed"|"balanced"|"packed"|null}',
      req.prompt,
      12000,
    );
    if (llm?.data) {
      parsed.destination ??= llm.data.destination ?? undefined;
      parsed.days ??= llm.data.days ?? undefined;
      parsed.budget ??= llm.data.budget ?? undefined;
      parsed.pace ??= llm.data.pace ?? undefined;
      if (!parsed.interests?.length && llm.data.interests?.length) parsed.interests = llm.data.interests;
    }
  }

  const intent: TripIntent = {
    destination: req.destination || parsed.destination || '',
    days: Math.min(14, Math.max(1, req.days ?? parsed.days ?? 4)),
    startDate: startOfDay(req.startDate ?? parsed.startDate ?? addDays(new Date(), 14)),
    travelers: req.travelers ?? parsed.travelers ?? { adults: 2, children: 0 },
    budget: req.budget ?? parsed.budget ?? 'MODERATE',
    pace: req.pace ?? parsed.pace ?? 'balanced',
    interests: req.interests?.length ? req.interests : parsed.interests ?? ['culture', 'food', 'nature'],
  };
  if (!intent.destination) throw Object.assign(new Error('Tell us where you want to go — e.g. “5 relaxed days in Lisbon”.'), { status: 400 });

  // Geocode: curated destination first (fast, reliable), then live.
  const curatedDest = await Destination.findOne({ name: new RegExp(`^${escapeRegex(intent.destination)}$`, 'i') }).lean();
  let geo: GeoPoint | null = curatedDest?.location?.coordinates
    ? { name: curatedDest.name, displayName: `${curatedDest.name}, ${curatedDest.country}`, country: curatedDest.country, lat: curatedDest.location.coordinates[1], lng: curatedDest.location.coordinates[0], source: 'curated' }
    : null;
  if (!geo && req.coords) geo = { name: intent.destination, displayName: [intent.destination, req.coords.country].filter(Boolean).join(', '), country: req.coords.country, lat: req.coords.lat, lng: req.coords.lng, source: 'nominatim' };
  // Curated destinations already carry coordinates + currency, so the live geocoder is only hit for new places.
  if (!geo) geo = await geocode(intent.destination);
  if (!geo) throw Object.assign(new Error(`We couldn't find “${intent.destination}” on the map. Try a city name.`), { status: 422 });
  const destName = curatedDest?.name ?? geo.name;

  const destCurrency = curatedDest?.currency ?? currencyFor(geo.countryCode);
  const [places, wx, wiki, rate, staysLive, rentalsLive, hotels, shops, snippets] = await Promise.all([
    gatherPlaces(destName, geo.lat, geo.lng),
    deadline(weather(geo.lat, geo.lng, intent.startDate, intent.days), LIVE_BUDGET_MS, [], 'weather'),
    deadline(wikiSummary(destName), 8000, null, 'wikipedia'),
    fxRate(env.BASE_CURRENCY, destCurrency),
    deadline(staysNear(geo.lat, geo.lng), LIVE_BUDGET_MS, [], 'overpass stays'),
    deadline(rentalsNear(geo.lat, geo.lng), LIVE_BUDGET_MS, [], 'overpass rentals'),
    Hotel.find({ isActive: true, $or: [{ city: new RegExp(`^${escapeRegex(destName)}$`, 'i') }, { location: { $geoWithin: { $centerSphere: [[geo.lng, geo.lat], 60 / 6371] } } }] }).sort({ rating: -1 }).limit(6).lean(),
    RentalShop.find({ isActive: true, $or: [{ destination: new RegExp(`^${escapeRegex(destName)}$`, 'i') }, { location: { $geoWithin: { $centerSphere: [[geo.lng, geo.lat], 40 / 6371] } } }] }).limit(6).lean(),
    provider ? travelSnippets(destName) : Promise.resolve([] as string[]),
  ]);

  // Score candidates by interest match + rating.
  const wanted = new Set(intent.interests.flatMap((i) => KIND_INTEREST[i] ?? []));
  // Curated picks lead; interests nudge; theatres/cinemas (dense on Wikipedia, rarely a daytime plan) sink.
  const score = (c: Cand) => c.rating + (wanted.has(c.kind) ? 0.6 : 0) + (c.source === 'curated' ? 1.1 : 0) - (c.kind === 'ACTIVITY' && c.source !== 'curated' ? 0.9 : 0) - (intent.budget === 'SHOESTRING' ? c.priceLevel * 0.2 : 0);
  const byScore = [...places].sort((a, b) => score(b) - score(a));
  const sights = byScore.filter((c) => !['FOOD', 'CAFE', 'NIGHTLIFE'].includes(c.kind));
  const food = byScore.filter((c) => c.kind === 'FOOD' || (c.kind === 'CAFE' && wanted.has('CAFE')));
  const evening = byScore.filter((c) => ['VIEWPOINT', 'BEACH', 'NIGHTLIFE', 'ACTIVITY'].includes(c.kind));
  // Rain backups: museums first, then cafés/markets, theatres last (they're rarely open at 10am).
  const INDOOR_RANK: Partial<Record<PoiKind, number>> = { MUSEUM: 0, CAFE: 1, SHOPPING: 1, TEMPLE: 2, ACTIVITY: 3 };
  const indoorPool = byScore.filter((c) => c.indoor && c.kind !== 'FOOD').sort((a, b) => (INDOOR_RANK[a.kind] ?? 2) - (INDOOR_RANK[b.kind] ?? 2));

  const perDay = intent.pace === 'relaxed' ? 2 : intent.pace === 'packed' ? 4 : 3;
  const used = new Set<string>();
  const take = (pool: Cand[], near?: { lat: number; lng: number }) => {
    const avail = pool.filter((c) => !used.has(c.name));
    if (!avail.length) return null;
    const pick = near ? avail.slice(0, 12).sort((a, b) => haversineKm(near, a) - haversineKm(near, b))[0] : avail[0];
    used.add(pick.name);
    return pick;
  };

  // Split top sights into geographic day-clusters via nearest-neighbour route then chunking.
  // Variety: no single kind may fill more than ~a third of the sight budget.
  const need = intent.days * perDay + 4;
  const perKindCap = Math.max(2, Math.ceil(need / 3));
  const kindCount: Partial<Record<PoiKind, number>> = {};
  const sightBudget = sights.filter((c) => {
    const n = kindCount[c.kind] ?? 0;
    if (n >= perKindCap) return false;
    kindCount[c.kind] = n + 1;
    return true;
  }).slice(0, need);
  const routed = routeOrder(sightBudget, { lat: geo.lat, lng: geo.lng });
  const chunks: Cand[][] = Array.from({ length: intent.days }, (_, i) => routed.slice(i * perDay, (i + 1) * perDay));

  const cost = BUDGET_COST[intent.budget];
  const pax = intent.travelers.adults + intent.travelers.children * 0.6;

  const days = Array.from({ length: intent.days }, (_, i) => {
    const date = addDays(intent.startDate, i);
    const w: DayWeather | undefined = wx[i];
    const wet = !!w?.wet;
    const dayItems: Record<string, unknown>[] = [];
    const sightsToday = chunks[i].filter((c) => !used.has(c.name));
    sightsToday.forEach((c) => used.add(c.name));
    const anchor = sightsToday[0] ?? { lat: geo.lat, lng: geo.lng };

    const mkAlt = (c: { lat: number; lng: number }) => {
      const alt = take(indoorPool, c);
      if (alt) return { title: alt.name, category: alt.kind, description: alt.description ?? `Indoor backup near your original stop.`, place: placeRef(alt), indoor: true };
      const f = INDOOR_FILLERS[(i + dayItems.length) % INDOOR_FILLERS.length];
      return { title: f.title, category: f.kind, description: f.description, place: placeRef({ name: f.title, lat: c.lat, lng: c.lng }), indoor: true };
    };

    const mkItem = (slot: Slot, c: Cand | null, fallbackIdx = 0) => {
      const f = FILLERS[slot][(i + fallbackIdx) % FILLERS[slot].length];
      const base = c
        ? { title: c.name, category: c.kind, description: c.description, place: placeRef(c), indoor: c.indoor, durationMins: c.durationMins }
        : { title: f.title, category: f.kind, description: f.description, place: placeRef({ name: destName, lat: anchor.lat, lng: anchor.lng }), indoor: f.indoor, durationMins: 90 };
      const isMeal = slot === 'LUNCH' || slot === 'DINNER';
      const near = 'name' in anchor ? (anchor as Cand).name : null;
      if (!c && isMeal && near) {
        base.title = `${slot === 'LUNCH' ? 'Lunch' : 'Dinner'} near ${near}`;
        base.description = slot === 'LUNCH' ? 'Walk two streets off the main square and eat where the locals queue.' : 'Ask your host for their neighbourhood favourite — book ahead on weekends.';
      }
      const item: Record<string, unknown> = {
        slot,
        time: SLOT_TIME[slot],
        ...base,
        estCost: Math.round((isMeal ? cost.meal * (slot === 'DINNER' ? 1.4 : 1) : cost.activity * (c?.priceLevel ?? 1)) * pax),
        swapped: false,
      };
      if (!base.indoor && !isMeal) item.alternative = mkAlt(base.place);
      return wet && item.alternative ? { ...(applyWeather(item as never) as Record<string, unknown>), swapped: true } : item;
    };

    const [s1, s2, s3, s4] = sightsToday;
    dayItems.push(mkItem('MORNING', s1 ?? null));
    dayItems.push(mkItem('LUNCH', take(food, s1 ?? anchor)));
    if (perDay >= 2) dayItems.push(mkItem('AFTERNOON', s2 ?? null, 1));
    if (perDay >= 4 && s4) dayItems.push(mkItem('AFTERNOON', s4, 2));
    const eve = s3 && ['VIEWPOINT', 'BEACH', 'NIGHTLIFE'].includes(s3.kind) ? s3 : take(evening, s2 ?? anchor) ?? s3 ?? null;
    if (perDay >= 3 || eve) dayItems.push(mkItem('EVENING', eve, 1));
    dayItems.push(mkItem('DINNER', take(food, eve ?? anchor)));

    const plain = dayItems.map((x) => ({ kind: (x.category as PoiKind) ?? 'SIGHT' }));
    return {
      dayNumber: i + 1,
      date,
      theme: i === 0 && !wet ? 'Arrive & find your feet' : themeFor(plain, wet),
      weather: w ? { code: w.code, summary: w.summary, tMax: w.tMax, tMin: w.tMin, precipProb: w.precipProb, wet: w.wet, source: w.source } : undefined,
      items: dayItems,
    };
  });

  /* Stays: bookable Voyara hotels first, then live OSM stays as inspiration. */
  const tierPrice = (p: number) => (intent.budget === 'LUXURY' ? -p : intent.budget === 'SHOESTRING' ? p : Math.abs(p - cost.stayFallback));
  const stays = [
    ...hotels
      .sort((a, b) => tierPrice(a.priceFrom) - tierPrice(b.priceFrom))
      .map((h) => ({ hotel: h._id, name: h.name, pricePerNight: h.priceFrom, rating: h.rating, lat: h.location?.coordinates?.[1], lng: h.location?.coordinates?.[0], image: h.images?.[0], source: 'voyara', bookable: true })),
    ...staysLive.slice(0, 6).map((s) => ({ name: s.name, pricePerNight: undefined, rating: s.stars, lat: s.lat, lng: s.lng, source: 'openstreetmap', bookable: false })),
  ];

  const rentals = [
    ...shops.flatMap((s) => s.vehicles.slice(0, 2).map((v) => ({ shop: s._id, name: s.name, vehicleType: v.type, pricePerDay: v.pricePerDay, lat: s.location?.coordinates?.[1], lng: s.location?.coordinates?.[0], source: 'voyara', bookable: true }))),
    ...rentalsLive.slice(0, 5).map((r) => ({ name: r.name, vehicleType: r.vehicleTypes[0], lat: r.lat, lng: r.lng, source: 'openstreetmap', bookable: false })),
  ];

  const nights = Math.max(1, intent.days - 1);
  const stayPerNight = (stays[0]?.pricePerNight as number | undefined) ?? cost.stayFallback;
  const activities = days.reduce((s, d) => s + d.items.filter((x) => !['LUNCH', 'DINNER'].includes(String(x.slot))).reduce((a, x) => a + Number(x.estCost ?? 0), 0), 0);
  const foodCost = days.reduce((s, d) => s + d.items.filter((x) => ['LUNCH', 'DINNER'].includes(String(x.slot))).reduce((a, x) => a + Number(x.estCost ?? 0), 0), 0);
  const transport = cost.transport * intent.days;
  const estimate = { stay: Math.round(stayPerNight * nights), food: Math.round(foodCost), activities: Math.round(activities), transport, total: 0, currency: env.BASE_CURRENCY };
  estimate.total = estimate.stay + estimate.food + estimate.activities + estimate.transport;

  let summary = `${intent.days} ${intent.pace} days in ${destName} for ${intent.travelers.adults + intent.travelers.children} — built around ${intent.interests.slice(0, 3).join(', ')}. Each day is clustered by neighbourhood to cut transit, and every outdoor stop carries an indoor backup that swaps in automatically when the forecast turns.`;
  let engine = 'rules';

  // Optional LLM polish: day themes + one-line summary. Structure stays deterministic.
  if (provider) {
    const llm = await llmJson<{ summary?: string; themes?: string[]; tips?: string[] }>(
      'You are Voyara, a concise travel architect. Reply ONLY JSON {"summary": string (<= 60 words), "themes": string[] (one short evocative title per day), "tips": string[] (3 practical local tips)}.',
      JSON.stringify({ destination: destName, intent, days: days.map((d) => d.items.map((x) => x.title)), context: snippets.slice(0, 3) }),
    );
    if (llm?.data) {
      engine = llm.provider;
      if (llm.data.summary) summary = llm.data.summary;
      llm.data.themes?.forEach((t, i) => days[i] && t && (days[i].theme = t));
      if (llm.data.tips?.length) days[0] && ((days[0] as Record<string, unknown>).notes = llm.data.tips.join(' · '));
    }
  }

  return {
    title: `${intent.days} days in ${destName}`,
    prompt: req.prompt,
    destination: { name: destName, country: geo.country ?? curatedDest?.country, lat: geo.lat, lng: geo.lng, displayName: geo.displayName },
    startDate: intent.startDate,
    endDate: addDays(intent.startDate, intent.days - 1),
    travelers: intent.travelers,
    budget: intent.budget,
    pace: intent.pace,
    interests: intent.interests,
    summary,
    overview: wiki ?? (curatedDest ? { extract: curatedDest.summary, thumbnail: curatedDest.image } : undefined),
    coverImage: curatedDest?.image ?? wiki?.thumbnail,
    days,
    stays,
    rentals,
    estimate,
    fx: rate ? { base: env.BASE_CURRENCY, quote: destCurrency, rate } : undefined,
    engine,
    sources: {
      places: places.length,
      weather: wx[0]?.source ?? 'none',
      geocoder: geo.source,
    },
  };
}

export type BuiltItinerary = Awaited<ReturnType<typeof buildItinerary>>;
export const asObjectId = (id: string) => new Types.ObjectId(id);

/* ────────────────────────── Multi-stop routes (the Globe) ────────────────────────── */

export interface RouteStop {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  days: number;
}

export interface RouteRequest {
  stops: RouteStop[];
  startDate?: Date;
  travelers?: { adults: number; children: number };
  budget?: Budget;
  pace?: Pace;
  interests?: string[];
}

/** Rough door-to-door flight time: cruise ~780 km/h plus 40 min for climb/descent/taxi. */
export function flightLeg(a: { name: string; lat: number; lng: number }, b: { name: string; lat: number; lng: number }) {
  const km = Math.round(haversineKm(a, b));
  const minutes = Math.round((km / 780) * 60 + 40);
  return { from: a.name, to: b.name, km, minutes, co2kg: Math.round(km * 0.09), mode: km < 350 ? 'ROAD' : 'FLIGHT' };
}

export async function buildRoute(req: RouteRequest) {
  if (req.stops.length < 2) throw Object.assign(new Error('Pick at least two places on the globe'), { status: 400 });
  const start = startOfDay(req.startDate ?? addDays(new Date(), 21));
  const shared = { travelers: req.travelers, budget: req.budget, pace: req.pace, interests: req.interests };

  // Build every city in parallel; each gets its own date window.
  let offset = 0;
  const windows = req.stops.map((s) => {
    const w = { stop: s, startDate: addDays(start, offset) };
    offset += s.days;
    return w;
  });
  const parts = await Promise.all(windows.map((w) => buildItinerary({ ...shared, destination: w.stop.name, coords: { lat: w.stop.lat, lng: w.stop.lng, country: w.stop.country }, days: w.stop.days, startDate: w.startDate })));

  const legs = req.stops.slice(1).map((s, i) => flightLeg(req.stops[i], s));
  const pax = (req.travelers?.adults ?? 2) + (req.travelers?.children ?? 0);
  const fare = req.budget === 'LUXURY' ? 14 : req.budget === 'SHOESTRING' ? 4.5 : 7; // ₹ per km per traveller
  const flights = legs.reduce((sum, l) => sum + (l.mode === 'FLIGHT' ? l.km * fare : l.km * 3) * pax, 0);

  let dayNo = 0;
  const days = parts.flatMap((p, i) =>
    p.days.map((d, j) => {
      dayNo++;
      const items = [...d.items];
      if (i > 0 && j === 0) {
        const leg = legs[i - 1];
        const h = Math.floor(leg.minutes / 60);
        const m = leg.minutes % 60;
        items.unshift({
          slot: 'TRANSIT',
          time: '07:30',
          title: `${leg.mode === 'FLIGHT' ? 'Fly' : 'Drive'} ${leg.from} → ${leg.to}`,
          category: leg.mode,
          description: `${leg.km.toLocaleString('en-IN')} km · about ${h}h ${m}m door to door · ~${leg.co2kg} kg CO₂ per traveller`,
          place: { name: leg.to, lat: req.stops[i].lat, lng: req.stops[i].lng },
          indoor: true,
          estCost: Math.round((leg.mode === 'FLIGHT' ? leg.km * fare : leg.km * 3) * pax),
          swapped: false,
        });
      }
      return { ...d, dayNumber: dayNo, theme: j === 0 ? `${p.destination.name} · ${d.theme}` : d.theme, items };
    }),
  );

  const sum = (k: 'stay' | 'food' | 'activities' | 'transport') => parts.reduce((s, p) => s + (p.estimate[k] ?? 0), 0);
  const estimate = { stay: sum('stay'), food: sum('food'), activities: sum('activities'), transport: Math.round(sum('transport') + flights), total: 0, currency: env.BASE_CURRENCY };
  estimate.total = estimate.stay + estimate.food + estimate.activities + estimate.transport;
  const names = parts.map((p) => p.destination.name);
  const totalKm = legs.reduce((s, l) => s + l.km, 0);

  return {
    title: names.join(' → '),
    prompt: `${req.stops.map((s) => `${s.days}d ${s.name}`).join(', ')}`,
    destination: { ...parts[0].destination, name: names.join(' → '), displayName: names.join(' → ') },
    stops: windows.map((w, i) => ({ name: parts[i].destination.name, country: parts[i].destination.country, lat: w.stop.lat, lng: w.stop.lng, days: w.stop.days, startDate: w.startDate })),
    legs,
    startDate: start,
    endDate: addDays(start, offset - 1),
    travelers: parts[0].travelers,
    budget: parts[0].budget,
    pace: parts[0].pace,
    interests: parts[0].interests,
    summary: `${names.length} cities, ${offset} days, ${totalKm.toLocaleString('en-IN')} km in the air. Each city is planned neighbourhood by neighbourhood with its own forecast; travel days open with the flight so nothing collides.`,
    overview: parts[0].overview,
    coverImage: parts[0].coverImage,
    days,
    stays: parts.flatMap((p, i) => p.stays.map((s) => ({ ...s, city: p.destination.name, stopIndex: i }))),
    rentals: parts.flatMap((p, i) => p.rentals.map((r) => ({ ...r, city: p.destination.name, stopIndex: i }))),
    estimate,
    fx: parts[0].fx,
    engine: parts[0].engine,
    sources: { places: parts.reduce((s, p) => s + p.sources.places, 0), weather: parts[0].sources.weather, geocoder: 'globe' },
  };
}
