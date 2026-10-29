import { describe, expect, it, vi } from 'vitest';
import { chunk, createClient, HttpError } from '../http';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('http client', () => {
  it('builds URLs with repeated params', async () => {
    const fetch = vi.fn(async () => json({ ok: 1 }));
    const client = createClient({ baseUrl: '/api/', fetch });
    await client.get('/search', { q: 'a b', tag: ['x', 'y'], skip: undefined });
    expect(fetch).toHaveBeenCalledWith('/api/search?q=a+b&tag=x&tag=y', expect.anything());
  });

  it('posts JSON', async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ ok: 1 }));
    await createClient({ baseUrl: '/api', fetch }).post('/features', { tracks: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/features');
    expect(init).toMatchObject({ method: 'POST', body: '{"tracks":[]}' });
  });

  it('retries 429 using Retry-After, then succeeds', async () => {
    const sleep = vi.fn(async () => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ done: true }));
    const client = createClient({ baseUrl: 'x', fetch, sleep });
    await expect(client.get('/p')).resolves.toEqual({ done: true });
    expect(sleep.mock.calls).toEqual([[2000], [2000]]);
  });

  it('gives up after maxRetries, and does not retry other errors', async () => {
    const limited = vi.fn(async () => json({}, 429));
    await expect(createClient({ baseUrl: 'x', fetch: limited, sleep: async () => {}, maxRetries: 2 }).get('/p')).rejects.toMatchObject({ status: 429 });
    expect(limited).toHaveBeenCalledTimes(3);
    const bad = vi.fn(async () => json({}, 400));
    await expect(createClient({ baseUrl: 'x', fetch: bad }).get('/p')).rejects.toBeInstanceOf(HttpError);
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it('does not retry a bare 503, but honours 503 with Retry-After', async () => {
    const bare = vi.fn(async () => json({ error: 'GETSONGBPM_API_KEY is not set' }, 503));
    await expect(createClient({ baseUrl: 'x', fetch: bare }).get('/p')).rejects.toMatchObject({ status: 503 });
    expect(bare).toHaveBeenCalledTimes(1);
    const later = vi.fn().mockResolvedValueOnce(json({}, 503, { 'Retry-After': '1' })).mockResolvedValueOnce(json({ ok: 1 }));
    await expect(createClient({ baseUrl: 'x', fetch: later, sleep: async () => {} }).get('/p')).resolves.toEqual({ ok: 1 });
  });

  it('limits concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetch = vi.fn(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return json({});
    });
    const client = createClient({ baseUrl: 'x', fetch, concurrency: 2 });
    await Promise.all(Array.from({ length: 6 }, () => client.get('/p')));
    expect(peak).toBe(2);
  });

  it('chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
