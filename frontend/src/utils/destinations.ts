import type { Destination } from '../types';
import { CURATED_DESTINATIONS } from '../data/voyara';

/** Merge API destinations with the curated fallback so the UI always has imagery + copy. */
export function mergeDestinations(api: Destination[] | null | undefined): Destination[] {
  if (!api?.length) return CURATED_DESTINATIONS;
  const byName = new Map(CURATED_DESTINATIONS.map((d) => [d.name.toLowerCase(), d]));
  return api.map((d) => ({ ...byName.get(d.name.toLowerCase()), ...d, image: d.image ?? byName.get(d.name.toLowerCase())?.image }));
}

export function findDestination(name: string) {
  return CURATED_DESTINATIONS.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
}

export const unsplash = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

/** Resize an Unsplash URL; leaves other URLs untouched. */
export function sized(url: string | undefined, w: number) {
  if (!url) return url;
  return url.includes('images.unsplash.com') ? url.replace(/([?&])w=\d+/, `$1w=${w}`) : url;
}
