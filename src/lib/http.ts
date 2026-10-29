/** Small JSON client: limited concurrency and 429/503 retry with Retry-After or backoff. */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type Params = Record<string, string | number | string[] | undefined>;

export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Requests in flight at once. */
  concurrency?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Client {
  get<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function buildUrl(baseUrl: string, path: string, params: Params = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, String(item));
  }
  const q = qs.toString();
  return `${baseUrl.replace(/\/$/, '')}${path}${q ? `?${q}` : ''}`;
}

export function createClient({
  baseUrl,
  fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  concurrency = 2,
  maxRetries = 3,
  sleep = defaultSleep,
}: ClientOptions): Client {
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = () =>
    active < concurrency ? (active++, Promise.resolve()) : new Promise<void>((resolve) => waiting.push(resolve));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  async function send<T>(url: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await acquire();
      let res: Response;
      try {
        res = await fetchImpl(url, init);
      } finally {
        release();
      }
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      throw new HttpError(`${init.method ?? 'GET'} ${url} failed with ${res.status}`, res.status);
    }
  }

  return {
    get: (path, params, signal) => send(buildUrl(baseUrl, path, params), { headers: { Accept: 'application/json' }, signal }),
    post: (path, body, signal) =>
      send(buildUrl(baseUrl, path), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
  };
}
