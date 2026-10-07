import { env } from '../../config/env.js';
import { cached, TTL } from './cache.service.js';
import { fetchJSON, safe } from './http.js';

export interface GeoPoint {
  name: string;
  displayName: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lng: number;
  source: 'nominatim' | 'photon' | 'curated';
}

export type PoiKind = 'SIGHT' | 'MUSEUM' | 'NATURE' | 'FOOD' | 'CAFE' | 'NIGHTLIFE' | 'SHOPPING' | 'VIEWPOINT' | 'BEACH' | 'TEMPLE' | 'ACTIVITY';

export interface LivePoi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  indoor: boolean;
  tags?: Record<string, string>;
  source: string;
  description?: string;
  rating?: number;
}

export interface DayWeather {
  date: string;
  code: number;
  summary: string;
  tMax: number;
  tMin: number;
  precipProb: number;
  wet: boolean;
  source: 'open-meteo' | 'open-meteo-archive' | 'met.no' | 'estimate';
}

/* ──────────────── Geocoding: Nominatim → Photon ──────────────── */

export function geocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  return cached(`geo:${q.toLowerCase()}`, TTL.day * 7, async () => {
    const nominatim = await safe(
      'nominatim',
      fetchJSON<Array<{ lat: string; lon: string; name?: string; display_name: string; address?: { country?: string; country_code?: string } }>>(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`,
      ),
      [],
    );
    if (nominatim[0]) {
      const r = nominatim[0];
      return {
        name: r.name || q,
        displayName: r.display_name,
        country: r.address?.country,
        countryCode: r.address?.country_code?.toUpperCase(),
        lat: Number(r.lat),
        lng: Number(r.lon),
        source: 'nominatim' as const,
      };
    }
    const photon = await safe(
      'photon',
      fetchJSON<{ features: Array<{ geometry: { coordinates: [number, number] }; properties: { name?: string; country?: string; countrycode?: string; state?: string } }> }>(
        `https://photon.komoot.io/api/?limit=1&lang=en&q=${encodeURIComponent(q)}`,
      ),
      { features: [] },
    );
    const f = photon.features[0];
    if (f) {
      const p = f.properties;
      return {
        name: p.name || q,
        displayName: [p.name, p.state, p.country].filter(Boolean).join(', '),
        country: p.country,
        countryCode: p.countrycode?.toUpperCase(),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        source: 'photon' as const,
      };
    }
    return null;
  });
}

/* ──────────────── Weather: Open-Meteo → met.no → estimate ──────────────── */

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};

const isWet = (code: number, prob: number) => prob >= 60 || code >= 61 || (code >= 51 && prob >= 40);

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function weather(lat: number, lng: number, start: Date, days: number): Promise<DayWeather[]> {
  const startIso = iso(start);
  const key = `wx:${lat.toFixed(2)},${lng.toFixed(2)}:${startIso}:${days}`;
  return cached(key, TTL.hour * 3, async () => {
    const end = new Date(start.getTime() + (days - 1) * 86_400_000);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const horizon = (end.getTime() - today.getTime()) / 86_400_000;

    type Daily = { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: number[]; precipitation_sum?: number[] };

    if (horizon <= 15 && start >= today) {
      const om = await safe(
        'open-meteo',
        fetchJSON<{ daily: Daily }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${startIso}&end_date=${iso(end)}`,
        ),
        null,
      );
      if (om?.daily?.time?.length) {
        return om.daily.time.map((date, i) => {
          const code = om.daily.weather_code[i] ?? 0;
          const prob = om.daily.precipitation_probability_max?.[i] ?? 0;
          return { date, code, summary: WMO[code] ?? 'Mixed', tMax: Math.round(om.daily.temperature_2m_max[i]), tMin: Math.round(om.daily.temperature_2m_min[i]), precipProb: prob, wet: isWet(code, prob), source: 'open-meteo' as const };
        });
      }
      const metno = await metNo(lat, lng, start, days);
      if (metno.length) return metno;
    }

    // Beyond the forecast horizon → same dates last year from the archive as a "typical" outlook.
    const lyStart = new Date(start);
    lyStart.setUTCFullYear(lyStart.getUTCFullYear() - 1);
    const lyEnd = new Date(end);
    lyEnd.setUTCFullYear(lyEnd.getUTCFullYear() - 1);
    const arc = await safe(
      'open-meteo-archive',
      fetchJSON<{ daily: Daily }>(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${iso(lyStart)}&end_date=${iso(lyEnd)}`,
        { timeoutMs: 12000 },
      ),
      null,
    );
    if (arc?.daily?.time?.length) {
      return arc.daily.time.map((_, i) => {
        const code = arc.daily.weather_code[i] ?? 0;
        const mm = arc.daily.precipitation_sum?.[i] ?? 0;
        const prob = Math.min(95, Math.round(mm * 12));
        const date = iso(new Date(start.getTime() + i * 86_400_000));
        return { date, code, summary: `Typically ${(WMO[code] ?? 'mixed').toLowerCase()}`, tMax: Math.round(arc.daily.temperature_2m_max[i]), tMin: Math.round(arc.daily.temperature_2m_min[i]), precipProb: prob, wet: isWet(code, prob), source: 'open-meteo-archive' as const };
      });
    }
    return Array.from({ length: days }, (_, i) => ({
      date: iso(new Date(start.getTime() + i * 86_400_000)),
      code: 2, summary: 'Seasonal estimate', tMax: 28, tMin: 20, precipProb: 20, wet: false, source: 'estimate' as const,
    }));
  });
}

async function metNo(lat: number, lng: number, start: Date, days: number): Promise<DayWeather[]> {
  const data = await safe(
    'met.no',
    fetchJSON<{ properties: { timeseries: Array<{ time: string; data: { instant: { details: { air_temperature: number } }; next_6_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } } } }> } }>(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lng.toFixed(3)}`,
    ),
    null,
  );
  if (!data) return [];
  const byDay = new Map<string, { temps: number[]; rain: number; symbols: string[] }>();
  for (const t of data.properties.timeseries) {
    const d = t.time.slice(0, 10);
    const e = byDay.get(d) ?? { temps: [], rain: 0, symbols: [] };
    e.temps.push(t.data.instant.details.air_temperature);
    if (t.data.next_6_hours) {
      e.rain += t.data.next_6_hours.details.precipitation_amount ?? 0;
      e.symbols.push(t.data.next_6_hours.summary.symbol_code);
    }
    byDay.set(d, e);
  }
  const out: DayWeather[] = [];
  for (let i = 0; i < days; i++) {
    const date = iso(new Date(start.getTime() + i * 86_400_000));
    const e = byDay.get(date);
    if (!e) continue;
    const rainy = e.symbols.some((s) => /rain|sleet|snow|thunder/.test(s));
    const prob = Math.min(95, Math.round(e.rain * 15 + (rainy ? 35 : 0)));
    const code = rainy ? 63 : e.symbols.some((s) => /cloud/.test(s)) ? 3 : 1;
    out.push({ date, code, summary: WMO[code], tMax: Math.round(Math.max(...e.temps)), tMin: Math.round(Math.min(...e.temps)), precipProb: prob, wet: isWet(code, prob), source: 'met.no' });
  }
  return out;
}

/* ──────────────── Wikipedia overview ──────────────── */

export function wikiSummary(title: string) {
  return cached(`wiki:${title.toLowerCase()}`, TTL.day * 7, () =>
    safe(
      'wikipedia',
      fetchJSON<{ extract?: string; thumbnail?: { source: string }; originalimage?: { source: string }; content_urls?: { desktop?: { page: string } }; type?: string }>(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
      ).then((r) => (r.type === 'disambiguation' || !r.extract ? null : { extract: r.extract, thumbnail: r.originalimage?.source ?? r.thumbnail?.source, url: r.content_urls?.desktop?.page })),
      null,
    ),
  );
}

/* ──────────────── FX (open.er-api.com) ──────────────── */

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', FR: 'EUR', PT: 'EUR', ES: 'EUR', IT: 'EUR', DE: 'EUR', NL: 'EUR', GR: 'EUR', JP: 'JPY', ID: 'IDR', TH: 'THB',
  AE: 'AED', GB: 'GBP', US: 'USD', SG: 'SGD', LK: 'LKR', NP: 'NPR', MV: 'MVR', VN: 'VND', MY: 'MYR', AU: 'AUD', TR: 'TRY',
  CH: 'CHF', KR: 'KRW', CN: 'CNY', HK: 'HKD', EG: 'EGP', MA: 'MAD', ZA: 'ZAR', MX: 'MXN', BR: 'BRL', CA: 'CAD', NZ: 'NZD', BT: 'BTN',
};

export const currencyFor = (countryCode?: string) => (countryCode && COUNTRY_CURRENCY[countryCode]) || 'USD';

export function fxRate(base: string, quote: string) {
  if (base === quote) return Promise.resolve(1);
  return cached(`fx:${base}`, TTL.hour * 6, () =>
    safe('er-api', fetchJSON<{ result: string; rates: Record<string, number> }>(`https://open.er-api.com/v6/latest/${base}`), null).then((r) =>
      r?.result === 'success' ? r.rates : null,
    ),
  ).then((rates) => rates?.[quote] ?? null);
}

/* ──────────────── Overpass (OSM) ──────────────── */

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

type OsmEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** After every mirror fails, skip Overpass for a while so requests don't each wait out the timeouts. */
let overpassDownUntil = 0;
const OVERPASS_COOLDOWN_MS = 5 * 60_000;

/** Returns null when every mirror fails, so callers don't cache an outage as "no results". */
async function overpass(query: string): Promise<OsmEl[] | null> {
  if (Date.now() < overpassDownUntil) return null;
  for (const endpoint of OVERPASS) {
    try {
      const r = await fetchJSON<{ elements: OsmEl[] }>(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: 9000,
      });
      return r.elements ?? [];
    } catch (err) {
      console.warn(`  ↯ overpass ${new URL(endpoint).host}: ${(err as Error).message}`);
    }
  }
  overpassDownUntil = Date.now() + OVERPASS_COOLDOWN_MS;
  console.warn('  ↯ overpass: all mirrors failed — pausing for 5 minutes, curated + Wikipedia data only');
  return null;
}

const pos = (e: OsmEl) => ({ lat: e.lat ?? e.center?.lat ?? 0, lng: e.lon ?? e.center?.lon ?? 0 });

function classify(t: Record<string, string>): { kind: PoiKind; indoor: boolean } | null {
  if (t.tourism === 'museum' || t.tourism === 'gallery') return { kind: 'MUSEUM', indoor: true };
  if (t.tourism === 'viewpoint') return { kind: 'VIEWPOINT', indoor: false };
  if (t.natural === 'beach') return { kind: 'BEACH', indoor: false };
  if (t.amenity === 'place_of_worship' && (t.historic || t.tourism || t.wikidata)) return { kind: 'TEMPLE', indoor: false };
  if (t.historic && ['castle', 'fort', 'monument', 'palace', 'ruins', 'archaeological_site', 'memorial', 'city_gate'].includes(t.historic)) return { kind: 'SIGHT', indoor: false };
  if (t.tourism === 'attraction' || t.tourism === 'zoo' || t.tourism === 'theme_park') return { kind: 'SIGHT', indoor: false };
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'nature_reserve' || t.natural === 'waterfall' || t.natural === 'peak') return { kind: 'NATURE', indoor: false };
  if (t.amenity === 'restaurant' || t.amenity === 'food_court') return { kind: 'FOOD', indoor: true };
  if (t.amenity === 'cafe') return { kind: 'CAFE', indoor: true };
  if (t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'nightclub') return { kind: 'NIGHTLIFE', indoor: true };
  if (t.amenity === 'marketplace' || t.shop === 'mall' || t.shop === 'department_store') return { kind: 'SHOPPING', indoor: t.amenity !== 'marketplace' };
  if (t.amenity === 'theatre' || t.amenity === 'arts_centre' || t.amenity === 'cinema') return { kind: 'ACTIVITY', indoor: true };
  return null;
}

export function pois(lat: number, lng: number, radiusM = 9000): Promise<LivePoi[]> {
  return cached<LivePoi[] | null>(`poi:${lat.toFixed(3)},${lng.toFixed(3)}:${radiusM}`, TTL.day, async () => {
    const r = radiusM;
    const q = `[out:json][timeout:18];
(
  nwr(around:${r},${lat},${lng})["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park)$"]["name"];
  nwr(around:${r},${lat},${lng})["historic"~"^(castle|fort|monument|palace|ruins|archaeological_site|city_gate)$"]["name"];
  nwr(around:${r},${lat},${lng})["natural"~"^(beach|waterfall|peak)$"]["name"];
  nwr(around:${r},${lat},${lng})["leisure"~"^(park|garden|nature_reserve)$"]["name"]["wikidata"];
  nwr(around:${r},${lat},${lng})["amenity"="place_of_worship"]["name"]["wikidata"];
  nwr(around:${Math.min(r, 5000)},${lat},${lng})["amenity"~"^(restaurant|cafe|bar|pub|marketplace|theatre|arts_centre)$"]["name"]["cuisine"];
  nwr(around:${Math.min(r, 5000)},${lat},${lng})["amenity"~"^(restaurant|cafe|bar)$"]["name"]["website"];
);
out center tags 260;`;
    const els = await overpass(q);
    if (!els) return null;
    const seen = new Set<string>();
    const out: LivePoi[] = [];
    for (const e of els) {
      const t = e.tags ?? {};
      const name = t['name:en'] || t.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      const c = classify(t);
      if (!c) continue;
      const p = pos(e);
      if (!p.lat) continue;
      seen.add(name.toLowerCase());
      const fame = (t.wikidata ? 2 : 0) + (t.wikipedia ? 2 : 0) + (t.website ? 0.5 : 0) + (t.opening_hours ? 0.3 : 0);
      out.push({
        id: `osm:${e.type}/${e.id}`,
        name,
        kind: c.kind,
        indoor: c.indoor,
        lat: p.lat,
        lng: p.lng,
        source: 'openstreetmap',
        rating: Math.min(4.9, 3.9 + fame * 0.2),
        description: t.description || [t.cuisine && `Cuisine: ${t.cuisine.replace(/;/g, ', ')}`, t.historic && `Historic ${t.historic}`, t.opening_hours && `Hours ${t.opening_hours}`].filter(Boolean).join(' · ') || undefined,
        tags: { cuisine: t.cuisine, wikidata: t.wikidata, website: t.website } as Record<string, string>,
      });
    }
    return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }).then((r) => r ?? []);
}

export interface LiveRental {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicleTypes: string[];
  phone?: string;
  website?: string;
  source: 'openstreetmap';
}

export function rentalsNear(lat: number, lng: number, radiusM = 12000): Promise<LiveRental[]> {
  return cached<LiveRental[] | null>(`rent:${lat.toFixed(3)},${lng.toFixed(3)}`, TTL.day, async () => {
    const q = `[out:json][timeout:15];
(
  nwr(around:${radiusM},${lat},${lng})["amenity"~"^(car_rental|bicycle_rental|motorcycle_rental|scooter_rental|boat_rental)$"];
  nwr(around:${radiusM},${lat},${lng})["shop"~"^(rental|motorcycle_rental|scooter)$"]["name"];
);
out center tags 60;`;
    const els = await overpass(q);
    if (!els) return null;
    return els
      .filter((e) => e.tags?.name || e.tags?.brand || e.tags?.operator)
      .map((e) => {
        const t = e.tags!;
        const types = new Set<string>();
        if (/car/.test(t.amenity ?? '')) types.add('CAR');
        if (/bicycle/.test(t.amenity ?? '')) types.add('BICYCLE');
        if (/motorcycle|scooter/.test(`${t.amenity}${t.shop}`)) types.add('SCOOTER');
        if (/boat/.test(t.amenity ?? '')) types.add('BOAT');
        if (!types.size) types.add('SCOOTER');
        return { id: `osm:${e.type}/${e.id}`, name: t.name || t.brand || t.operator, ...pos(e), vehicleTypes: [...types], phone: t.phone || t['contact:phone'], website: t.website, source: 'openstreetmap' as const };
      });
  }).then((r) => r ?? []);
}

export interface LiveStay {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  stars?: number;
  website?: string;
  source: 'openstreetmap';
}

export function staysNear(lat: number, lng: number, radiusM = 6000): Promise<LiveStay[]> {
  return cached<LiveStay[] | null>(`stay:${lat.toFixed(3)},${lng.toFixed(3)}`, TTL.day, async () => {
    const q = `[out:json][timeout:15];
nwr(around:${radiusM},${lat},${lng})["tourism"~"^(hotel|guest_house|hostel|resort|apartment|motel)$"]["name"];
out center tags 80;`;
    const els = await overpass(q);
    if (!els) return null;
    return els.map((e) => ({
      id: `osm:${e.type}/${e.id}`,
      name: e.tags!.name,
      kind: e.tags!.tourism,
      ...pos(e),
      stars: e.tags!.stars ? Number(e.tags!.stars) || undefined : undefined,
      website: e.tags!.website,
      source: 'openstreetmap' as const,
    }));
  }).then((r) => r ?? []);
}

/* ──────────────── Optional keyed providers ──────────────── */

export async function googlePlaces(query: string): Promise<LivePoi[]> {
  if (!env.GOOGLE_PLACES_API_KEY) return [];
  return cached(`gp:${query.toLowerCase()}`, TTL.day, () =>
    safe(
      'google-places',
      fetchJSON<{ places?: Array<{ id: string; displayName: { text: string }; location: { latitude: number; longitude: number }; rating?: number; types?: string[]; editorialSummary?: { text: string } }> }>(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY!,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.types,places.editorialSummary',
          },
          body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
        },
      ).then((r) =>
        (r.places ?? []).map((p) => {
          const types = p.types ?? [];
          const kind: PoiKind = types.includes('museum') || types.includes('art_gallery') ? 'MUSEUM' : types.includes('restaurant') ? 'FOOD' : types.includes('cafe') ? 'CAFE' : types.includes('park') ? 'NATURE' : 'SIGHT';
          return { id: `gp:${p.id}`, name: p.displayName.text, kind, indoor: kind === 'MUSEUM' || kind === 'FOOD' || kind === 'CAFE', lat: p.location.latitude, lng: p.location.longitude, rating: p.rating, description: p.editorialSummary?.text, source: 'google-places' };
        }),
      ),
      [],
    ),
  );
}

/** Short web-search snippets (Tavily or Exa) used purely as extra LLM context. */
export async function travelSnippets(destination: string): Promise<string[]> {
  if (env.TAVILY_API_KEY) {
    return safe(
      'tavily',
      fetchJSON<{ results: Array<{ content: string }> }>('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: `best things to do and eat in ${destination} travel tips`, max_results: 5 }),
      }).then((r) => r.results.map((x) => x.content.slice(0, 400))),
      [],
    );
  }
  if (env.EXA_API_KEY) {
    return safe(
      'exa',
      fetchJSON<{ results: Array<{ text?: string; title: string }> }>('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.EXA_API_KEY },
        body: JSON.stringify({ query: `${destination} travel guide things to do`, numResults: 5, contents: { text: { maxCharacters: 400 } } }),
      }).then((r) => r.results.map((x) => x.text ?? x.title)),
      [],
    );
  }
  return [];
}

export function liveSourcesStatus() {
  return {
    keyless: ['nominatim', 'photon', 'overpass', 'wikipedia-geosearch', 'open-meteo', 'met.no', 'wikipedia', 'er-api'],
    googlePlaces: !!env.GOOGLE_PLACES_API_KEY,
    amadeus: !!(env.AMADEUS_API_KEY && env.AMADEUS_API_SECRET),
    webSearch: env.TAVILY_API_KEY ? 'tavily' : env.EXA_API_KEY ? 'exa' : null,
  };
}

/* ──────────────── Wikipedia geosearch (fast keyless POIs) ──────────────── */

const WIKI_RULES: Array<[RegExp, PoiKind, boolean]> = [
  [/\b(museum|museu|musée|museo|gallery|galeria|centre of photography|art cent(er|re))\b/i, 'MUSEUM', true],
  [/\b(theatre|theater|teatro|coliseu|opera|concert hall)\b/i, 'ACTIVITY', true],
  [/\b(cathedral|church|igreja|basilica|chapel|mosque|masjid|temple|mandir|shrine|jinja|dera|gurudwara|synagogue|monastery|mosteiro|convent|abbey|dargah)\b/i, 'TEMPLE', false],
  [/\b(fort|fortress|castle|castelo|palace|palácio|palacio|mahal|haveli|tower|torre|monument|memorial|gate|arch|ruins|bridge|ponte|square|praça|plaza|piazza|fountain)\b/i, 'SIGHT', false],
  [/\b(park|parque|garden|jardim|jardin|botanical|lake|falls|waterfall|forest|reserve|hill|valley|river walk)\b/i, 'NATURE', false],
  [/\b(beach|praia|playa|plage|bay|cove)\b/i, 'BEACH', false],
  [/\b(viewpoint|miradouro|mirador|lookout|observatory|observation deck)\b/i, 'VIEWPOINT', false],
  [/\b(market|mercado|bazaar|souk|bolhão|livraria|bookshop|arcade)\b/i, 'SHOPPING', true],
  [/\b(café|cafe|coffee|patisserie|confeitaria)\b/i, 'CAFE', true],
  [/\b(restaurant|tavern|taverna|brasserie|bistro)\b/i, 'FOOD', true],
];
// Events and tragedies have coordinates too — never suggest them as places to visit.
const WIKI_EVENTS = /\b(bombings?|attacks?|massacres?|shootings?|murders?|killings?|assassinations?|explosions?|riots?|sieges?|hostage|incidents?|accidents?|crash(es)?|disasters?|fires?|floods?|earthquakes?|battles?|protests?|strikes?|uprisings?|stampedes?|collapse|derailment|hijacking|terror\w*)\b/i;
const WIKI_SKIP = /\b(cinema|station|metro|district|municipality|municipal|parish|university|school|college|hospital|stadium|airport|line|street|road|avenue|railway|company|building|residence|house of|courthouse|justice|justiça|chamber|constituency|neighbourhood|ward)\b/i;

export function wikiPois(lat: number, lng: number, radiusM = 10000): Promise<LivePoi[]> {
  return cached<LivePoi[] | null>(`wpoi:${lat.toFixed(3)},${lng.toFixed(3)}`, TTL.day, async () => {
    const r = await safe(
      'wikipedia geosearch',
      fetchJSON<{ query?: { geosearch: Array<{ pageid: number; title: string; lat: number; lon: number; dist: number }> } }>(
        `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=${Math.min(radiusM, 10000)}&gslimit=200&format=json`,
      ),
      null,
    );
    if (!r?.query) return null;
    const out: LivePoi[] = [];
    for (const g of r.query.geosearch) {
      const title = g.title.replace(/\s*\([^)]*\)$/, '');
      if (WIKI_SKIP.test(g.title) || WIKI_EVENTS.test(g.title)) continue;
      const rule = WIKI_RULES.find(([re]) => re.test(g.title));
      if (!rule) continue;
      out.push({
        id: `wiki:${g.pageid}`, name: title, kind: rule[1], indoor: rule[2], lat: g.lat, lng: g.lon, source: 'wikipedia',
        // Closer to the centre ≈ more central/iconic; keep within the 3.9–4.6 band so curated picks still lead.
        rating: Math.round((4.6 - Math.min(0.7, g.dist / 14000)) * 10) / 10,
      });
    }
    return out;
  }).then((x) => x ?? []);
}

/** Pre-fills the caches for curated destinations so the first visitor doesn't wait on cold public APIs. */
export async function warmCaches(destinations: { name: string; lat: number; lng: number }[]) {
  for (const d of destinations) {
    await Promise.allSettled([wikiPois(d.lat, d.lng), wikiSummary(d.name)]);
    await new Promise((r) => setTimeout(r, 400)); // be gentle with public APIs
  }
  for (const d of destinations) {
    if (Date.now() < overpassDownUntil) break;
    await pois(d.lat, d.lng).catch(() => undefined);
  }
}

/* ──────────────── Reverse geocoding (globe clicks) ──────────────── */

export function reverseGeocode(lat: number, lng: number): Promise<GeoPoint | null> {
  return cached(`rgeo:${lat.toFixed(2)},${lng.toFixed(2)}`, TTL.day * 7, async () => {
    const n = await safe(
      'nominatim reverse',
      fetchJSON<{ lat: string; lon: string; display_name?: string; address?: Record<string, string>; error?: string }>(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lng}`,
      ),
      null,
    );
    if (n && !n.error && n.address) {
      const a = n.address;
      const name = a.city || a.town || a.village || a.municipality || a.county || a.state || a.country;
      if (name) return { name, displayName: n.display_name ?? name, country: a.country, countryCode: a.country_code?.toUpperCase(), lat, lng, source: 'nominatim' as const };
    }
    const p = await safe(
      'photon reverse',
      fetchJSON<{ features: Array<{ properties: { name?: string; city?: string; state?: string; country?: string; countrycode?: string } }> }>(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`),
      { features: [] },
    );
    const f = p.features[0]?.properties;
    const name = f?.city || f?.name || f?.state || f?.country;
    return name ? { name, displayName: [name, f?.country].filter(Boolean).join(', '), country: f?.country, countryCode: f?.countrycode?.toUpperCase(), lat, lng, source: 'photon' as const } : null;
  });
}
