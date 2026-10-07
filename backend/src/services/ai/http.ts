const UA = 'Voyara/2.0 (whole-trip travel architect; contact: dev@voyara.travel)';

export async function fetchJSON<T = unknown>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 9000, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ← ${new URL(url).host}`);
  return (await res.json()) as T;
}

/** Runs a promise and returns fallback on any error, logging a one-line warning. */
export async function safe<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn(`  ↯ ${label}: ${(err as Error).message}`);
    return fallback;
  }
}

/** Resolves to fallback if p hasn't settled within ms — keeps the architect responsive when a free API is slow. */
export function deadline<T>(p: Promise<T>, ms: number, fallback: T, label = 'source'): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => {
      t = setTimeout(() => {
        console.warn(`  ↯ ${label}: exceeded ${ms}ms, using fallback`);
        resolve(fallback);
      }, ms);
    }),
  ]).finally(() => clearTimeout(t));
}
