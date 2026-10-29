/** Shared server plumbing: env, errors, caching, concurrency. */

export interface ServerEnv {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  FREQBLOG_API_KEY?: string;
  FREQBLOG_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface Deps {
  env: ServerEnv;
  fetch: typeof fetch;
  now?: () => number;
}

/** A required key isn't configured. */
export class ConfigError extends Error {
  name = 'ConfigError';
}

/** An upstream API answered with an error status. */
export class UpstreamError extends Error {
  name = 'UpstreamError';
  constructor(
    readonly service: string,
    readonly status: number,
    detail = `responded with ${status}`,
  ) {
    super(`${service} ${detail}`);
  }
}

/**
 * fetch with a deadline. A timeout or network failure becomes an UpstreamError
 * (504 / 502) naming the service, instead of hanging the whole request.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  service: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new UpstreamError(service, 504, `didn't respond within ${timeoutMs / 1000}s`);
    throw new UpstreamError(service, 502, `couldn't be reached (${(e as Error)?.message ?? e})`);
  }
}

/** The request we received is malformed. */
export class BadRequest extends Error {
  name = 'BadRequest';
}

/** Small TTL + size-capped cache. Lives as long as the server instance does. */
export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private max = 500,
    private now: () => number = Date.now,
  ) {}
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }
  has(key: string) {
    return this.get(key) !== undefined;
  }
  set(key: string, value: V, ttlMs = this.ttlMs) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, { value, expires: this.now() + ttlMs });
  }
}

/** Map with at most `limit` calls in flight; keeps order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** At most `n` calls in flight across everything that shares the limiter. */
export function createLimiter(n: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= n) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
