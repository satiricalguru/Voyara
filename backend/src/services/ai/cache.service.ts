/** Tiny in-process TTL cache with in-flight de-duplication — keeps free public APIs happy. */
interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 2000;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = loader()
    .then((value) => {
      if (value !== null && value !== undefined) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
        store.set(key, { value, expires: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const TTL = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

export function cacheStats() {
  return { entries: store.size, inflight: inflight.size };
}
