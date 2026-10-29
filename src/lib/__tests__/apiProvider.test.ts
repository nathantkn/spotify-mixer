import { describe, expect, it } from 'vitest';
import { createApiProvider, createFeatureStore } from '../apiProvider';
import type { Client, Params } from '../http';
import type { Track } from '../types';

const t = (id: string, title = id): Track => ({ id, title, artists: 'A', bpm: null, key: null, dur: 1, genres: [], hue: 0 });

function fakeClient(handler: (method: string, path: string, body: unknown, params?: Params) => unknown) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const client: Client = {
    async get<T>(path: string, params?: Params) {
      calls.push({ method: 'GET', path, body: params });
      return handler('GET', path, undefined, params) as T;
    },
    async post<T>(path: string, body: unknown) {
      calls.push({ method: 'POST', path, body });
      return handler('POST', path, body) as T;
    },
  };
  return { client, calls };
}

describe('api provider', () => {
  it('batches feature lookups by 20, sends only title/artists/id, and caches misses', async () => {
    const { client, calls } = fakeClient((_m, _p, body) => {
      const tracks = (body as { tracks: { id: string }[] }).tracks;
      return { features: Object.fromEntries(tracks.filter((x) => x.id !== 't1').map((x) => [x.id, { bpm: 100, key: '8A' }])) };
    });
    const provider = createApiProvider(client, createFeatureStore(() => undefined));
    const tracks = Array.from({ length: 25 }, (_, i) => ({ ...t(`t${i}`), img: 'https://secret/art.jpg' }));
    const out = await provider.features(tracks);
    expect(Object.keys(out)).toHaveLength(24);
    expect(calls.map((c) => (c.body as { tracks: unknown[] }).tracks.length)).toEqual([20, 5]);
    expect((calls[0].body as { tracks: object[] }).tracks[0]).toEqual({ id: 't0', title: 't0', artists: 'A' });
    await provider.features(tracks.slice(0, 3));
    expect(calls).toHaveLength(2);
  });

  it('remembers lookups across reloads for a week, then asks again', async () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } as Storage;
    let now = 0;
    const { client, calls } = fakeClient(() => ({ features: { a: { bpm: 90 } } }));
    await createApiProvider(client, createFeatureStore(() => storage, () => now)).features([t('a'), t('b')]);
    // "reload": a new provider and store reading the same storage
    const out = await createApiProvider(client, createFeatureStore(() => storage, () => now)).features([t('a'), t('b')]);
    expect(out).toEqual({ a: { bpm: 90 } });
    expect(calls).toHaveLength(1);
    now += 8 * 24 * 3_600_000;
    await createApiProvider(client, createFeatureStore(() => storage, () => now)).features([t('a'), t('b')]);
    expect(calls).toHaveLength(2);
  });

  it('caches recommendations per seed set, but not failures', async () => {
    let fail = true;
    const { client, calls } = fakeClient(() => {
      if (fail) throw new Error('down');
      return { tracks: [t('r1')] };
    });
    const provider = createApiProvider(client);
    await expect(provider.candidates([t('s1', 'Nights')])).rejects.toThrow('down');
    fail = false;
    expect(await provider.candidates([t('s1', 'Nights')])).toEqual([t('r1')]);
    await provider.candidates([t('s1', 'Nights')]);
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ seeds: [{ title: 'Nights', artists: 'A' }] });
    expect(await provider.candidates([])).toEqual([]);
  });

  it('exposes fetched candidates without asking again', async () => {
    const { client, calls } = fakeClient(() => ({ tracks: [t('r1')] }));
    const provider = createApiProvider(client, createFeatureStore(() => undefined));
    expect(provider.cachedCandidates([t('s1', 'Nights')])).toBeNull();
    await provider.candidates([t('s1', 'Nights')]);
    expect(provider.cachedCandidates([t('s1', 'Nights')])).toEqual([t('r1')]);
    expect(provider.cachedCandidates([t('s2', 'Other')])).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('looks up Spotify details in batches, sending the Spotify id, and remembers misses', async () => {
    const { client, calls } = fakeClient((_m, path, body) => {
      expect(path).toBe('/spotify-details');
      const tracks = (body as { tracks: { id: string }[] }).tracks;
      return { details: Object.fromEntries(tracks.filter((x) => x.id !== 'b').map((x) => [x.id, { spotifyId: `sp-${x.id}`, img: 'i', dur: 200 }])) };
    });
    const provider = createApiProvider(client, createFeatureStore(() => undefined), createFeatureStore(() => undefined));
    const out = await provider.spotifyDetails([{ ...t('a'), spotifyId: 'known' }, t('b')]);
    expect(out).toEqual({ a: { spotifyId: 'sp-a', img: 'i', dur: 200 } });
    expect((calls[0].body as { tracks: object[] }).tracks).toEqual([
      { id: 'a', title: 'a', artists: 'A', spotifyId: 'known' },
      { id: 'b', title: 'b', artists: 'A', spotifyId: undefined },
    ]);
    await provider.spotifyDetails([t('a'), t('b')]);
    expect(calls).toHaveLength(1);
  });

  it('searches only for non-empty queries', async () => {
    const { client, calls } = fakeClient(() => ({ tracks: [t('x')] }));
    const provider = createApiProvider(client);
    expect(await provider.search('  ')).toEqual([]);
    expect(await provider.search(' nights ')).toEqual([t('x')]);
    expect(calls).toEqual([{ method: 'GET', path: '/search', body: { q: 'nights' } }]);
  });
});
