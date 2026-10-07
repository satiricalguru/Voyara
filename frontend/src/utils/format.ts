const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function money(n: number | undefined | null, currency = 'INR') {
  const v = Math.round(n ?? 0);
  if (currency === 'INR') return `₹${inrFmt.format(v)}`;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${inrFmt.format(v)}`;
  }
}

export function compact(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function date(d: string | Date | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
}

export function dateLong(d: string | Date | undefined) {
  return date(d, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function weekday(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}

export function isoDay(d: Date = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return x.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function range(a: string, b: string) {
  return `${date(a)} — ${date(b)}`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function relTime(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return date(d, { month: 'short', year: 'numeric' });
}

export const titleCase = (s = '') => s.toLowerCase().replace(/(^|[\s_-])\w/g, (m) => m.toUpperCase()).replace(/_/g, ' ');
export const statusLabel = (s = '') => s.replace(/_/g, ' ');

export function fileSize(b = 0) {
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
