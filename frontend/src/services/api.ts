import axios, { AxiosError } from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5001/api';
export const TOKEN_KEY = 'voyara.token';

export const api = axios.create({ baseURL: API_URL, timeout: 45_000 });

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && getToken() && !err.config?.url?.includes('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('voyara:logout'));
    }
    return Promise.reject(err);
  },
);

/** Human message from any API error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the Voyara API. Is the backend running on port 5001?';
    const data = err.response.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return (err as Error)?.message ?? fallback;
}

/** Fetches a protected file (PDF) as a blob URL. */
export async function blobUrl(path: string) {
  const r = await api.get(path, { responseType: 'blob' });
  return URL.createObjectURL(r.data as Blob);
}

/** In-memory memo for read-mostly public GETs — instant back/forward navigation. */
const memo = new Map<string, { at: number; p: Promise<unknown> }>();
export function cachedGet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = fn().catch((e) => {
    memo.delete(key);
    throw e;
  });
  memo.set(key, { at: Date.now(), p });
  return p;
}
