import crypto from 'node:crypto';

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date | string) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function nightsBetween(checkIn: Date | string, checkOut: Date | string) {
  return Math.max(0, Math.round((startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime()) / DAY_MS));
}

export function addDays(d: Date | string, n: number) {
  return new Date(new Date(d).getTime() + n * DAY_MS);
}

export function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function code(prefix: string, len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}

export const token = (n = 16) => crypto.randomBytes(n).toString('base64url');

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
