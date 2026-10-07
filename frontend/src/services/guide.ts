import type { Budget, Destination, Hotel, Itinerary, LivePoi, LiveRental, Pace, RentalShop, WeatherDay } from '../types';
import { api, cachedGet } from './api';

export interface ArchitectInput {
  prompt?: string;
  destination?: string;
  startDate?: string;
  days?: number;
  travelers?: { adults: number; children: number };
  budget?: Budget;
  pace?: Pace;
  interests?: string[];
  save?: boolean;
}

export interface DestinationOverview {
  destination: { name: string; country?: string; lat: number; lng: number; currency: string; image?: string; bestMonths?: string[]; tags?: string[]; summary?: string };
  overview: { extract?: string; thumbnail?: string; url?: string } | null;
  weather: WeatherDay[];
  fx: { base: string; quote: string; rate: number } | null;
  places: LivePoi[];
}

export interface Place {
  name: string;
  country?: string;
  lat: number;
  lng: number;
  curated?: boolean;
  image?: string;
}

export interface RouteInput {
  stops: { name: string; lat: number; lng: number; country?: string; days: number }[];
  startDate?: string;
  travelers?: { adults: number; children: number };
  budget?: Budget;
  pace?: Pace;
  interests?: string[];
}

export const guideService = {
  route: (body: RouteInput) => api.post<{ itinerary: Itinerary }>('/guide/route', body, { timeout: 120_000 }).then((r) => r.data.itinerary),
  reverse: (lat: number, lng: number) => cachedGet(`rev:${lat.toFixed(2)},${lng.toFixed(2)}`, 30 * 60_000, () => api.get<{ place: Place }>('/guide/reverse', { params: { lat, lng } }).then((r) => r.data.place)),
  geocode: (q: string) => api.get<{ place: Place }>('/guide/geocode', { params: { q } }).then((r) => r.data.place),
  weatherToday: (destination: string) => cachedGet(`wx1:${destination.toLowerCase()}`, 30 * 60_000, () => api.get<{ weather: WeatherDay[] }>('/guide/live/weather', { params: { destination, days: 1 } }).then((r) => r.data.weather[0])),
  architect: (body: ArchitectInput) => api.post<{ itinerary: Itinerary }>('/guide/itinerary', body, { timeout: 90_000 }).then((r) => r.data.itinerary),
  destinations: () => cachedGet('destinations', 10 * 60_000, () => api.get<{ destinations: Destination[] }>('/guide/destinations').then((r) => r.data.destinations)),
  overview: (name: string) => cachedGet(`overview:${name.toLowerCase()}`, 10 * 60_000, () => api.get<DestinationOverview>('/guide/destination', { params: { name }, timeout: 60_000 }).then((r) => r.data)),
  rentals: (destination: string) =>
    cachedGet(`rentals:${destination.toLowerCase()}`, 2 * 60_000, () => api.get<{ destination: { name: string; lat: number; lng: number }; bookable: RentalShop[]; live: LiveRental[] }>('/guide/live/rentals', { params: { destination }, timeout: 60_000 }).then((r) => r.data)),
  stays: (destination: string) =>
    cachedGet(`stays:${destination.toLowerCase()}`, 2 * 60_000, () => api.get<{ destination: { name: string; lat: number; lng: number }; bookable: Hotel[]; live: { id: string; name: string; kind: string; lat: number; lng: number; stars?: number; website?: string }[] }>(
      '/guide/live/stays', { params: { destination }, timeout: 60_000 },
    ).then((r) => r.data)),
  status: () => api.get<{ llm: string; sources: Record<string, unknown> }>('/guide/status').then((r) => r.data),
};
