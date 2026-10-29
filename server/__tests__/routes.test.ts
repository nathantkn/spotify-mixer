import { describe, expect, it } from 'vitest';
import type { FeaturesResponse, TracksResponse } from '../../src/lib/apiTypes';
import type { ServerEnv } from '../core';
import { createFreqBlog } from '../freqblog';
import { createServices, handleApi } from '../routes';
import { fakeFetch, type Route } from './fakeFetch';

const ENV: ServerEnv = {
  SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', FREQBLOG_API_KEY: 'fb-key', GEMINI_API_KEY: 'gem-key',
};
const SPOTIFY_ID = '7eqoqGkKwgOaWNNHx90uEZ';
const GEMINI = 'POST generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

/** FreqBlog's catalogue in this test, keyed by lowercased track name. */
const FREQ: Record<string, object> = {
  nights: { id: 'f-nights', title: 'Nights', artist: 'Frank Ocean', bpm: 90, camelot: '6A', genres: ['R&B'] },
  often: { id: 'f-often', title: 'Often', artist: 'The Weeknd', audio_features: { bpm: 96, key: 'G-Minor' } },
  location: { id: 'f-loc', title: 'Location', artist: 'Khalid', bpm: 88, open_key: '2m' },
  queued: {},
};

const freqLookup: Route = (url) => {
  const track = (url.searchParams.get('track') ?? '').toLowerCase();
  if (track === 'queued') return new Response('{"status":"queued"}', { status: 202 });
  return FREQ[track] ?? new Response('{"error":"not found"}', { status: 404 });
};

// Spotify-only details, so we can prove none of them reach Gemini.
const spotifyTrack = (name: string, artist: string, id = SPOTIFY_ID) => ({
  id, name: `${name} - SPOTIFY_ONLY_SUFFIX`, duration_ms: 307151,
  artists: [{ name: artist }],
  album: { name: 'SPOTIFY_ONLY_ALBUM', images: [{ url: 'https://i.scdn.co/640', width: 640 }, { url: 'https://i.scdn.co/300', width: 300 }, { url: 'https://i.scdn.co/64', width: 64 }] },
});

function setup(overrides: Record<string, Route> = {}, env: ServerEnv = ENV) {
  const { fetch, calls } = fakeFetch({
    'POST accounts.spotify.com/api/token': () => ({ access_token: 'tok', expires_in: 3600 }),
    'GET api.spotify.com/v1/search': (url) => {
      const q = url.searchParams.get('q') ?? '';
      return { tracks: { items: q.toLowerCase().includes('often') ? [spotifyTrack('Often', 'The Weeknd', '4PhsKqMdgMEUSstTDAmMpg')] : [spotifyTrack('Nights', 'Frank Ocean')] } };
    },
    'GET api.freqblog.com/lookup': freqLookup,
    [GEMINI]: () => ({
      candidates: [{ content: { parts: [{ text: 'thinking about keys…', thought: true }, { text: JSON.stringify([
        { title: 'Often', artist: 'The Weeknd' },
        { title: 'Completely Made Up Song', artist: 'Nobody' }, // invented: must be dropped
        { title: 'Nights', artist: 'Frank Ocean' }, // the seed itself: must be dropped
        { title: 'Location', artist: 'Khalid' },
      ]) }] } }],
    }),
    ...overrides,
  });
  const svc = createServices({ env, fetch });
  const call = (method: string, path: string, body?: unknown) =>
    handleApi(new Request(`http://localhost${path}`, { method, body: body ? JSON.stringify(body) : undefined }), svc);
  const freqCalls = () => calls.filter((c) => c.url.host === 'api.freqblog.com');
  return { call, calls, freqCalls };
}

describe('/api/search', () => {
  it('finds songs on Spotify without spending FreqBlog lookups', async () => {
    const { call, calls, freqCalls } = setup();
    const { tracks } = (await (await call('GET', '/api/search?q=nights')).json()) as TracksResponse;
    expect(tracks[0]).toMatchObject({ id: `spotify:track:${SPOTIFY_ID}`, artists: 'Frank Ocean', dur: 307, img: 'https://i.scdn.co/300', bpm: null, key: null });
    const spotifyCall = calls.find((c) => c.key === 'GET api.spotify.com/v1/search')!;
    expect(spotifyCall.url.searchParams.get('limit')).toBe('10');
    expect(new Headers(spotifyCall.init.headers).get('Authorization')).toBe('Bearer tok');
    expect(freqCalls()).toHaveLength(0);
  });

  it('falls back to a FreqBlog name lookup when Spotify refuses app-only access', async () => {
    const { call } = setup({ 'GET api.spotify.com/v1/search': () => new Response('{}', { status: 403 }) });
    const { tracks } = (await (await call('GET', '/api/search?q=often')).json()) as TracksResponse;
    expect(tracks).toEqual([expect.objectContaining({ id: 'freqblog:f-often', title: 'Often', bpm: 96, key: '6A' })]);
  });
});

describe('/api/features', () => {
  it('returns features for matched tracks only, sending the key header', async () => {
    const { call, freqCalls } = setup();
    const res = await call('POST', '/api/features', {
      tracks: [
        { id: 'spotify:track:a', title: 'Nights - Remastered', artists: 'Frank Ocean, Someone' },
        { id: 'm1', title: 'My Unreleased Edit', artists: 'Me' },
        { id: 'q1', title: 'Queued', artists: 'X' },
      ],
    });
    const { features } = (await res.json()) as FeaturesResponse;
    expect(features).toEqual({ 'spotify:track:a': { bpm: 90, key: '6A', genres: ['r&b'] } });
    const first = freqCalls()[0];
    expect(first.url.searchParams.get('track')).toBe('Nights');
    expect(first.url.searchParams.get('artist')).toBe('Frank Ocean');
    expect(new Headers(first.init.headers).get('X-Api-Key')).toBe('fb-key');
  });

  it('rejects a lookup that resolves to a different song', async () => {
    const { call } = setup({ 'GET api.freqblog.com/lookup': () => ({ title: 'Nights', artist: 'Avenged Sevenfold', bpm: 130, camelot: '1A' }) });
    const { features } = (await (await call('POST', '/api/features', { tracks: [{ id: 'a', title: 'Nights', artists: 'Frank Ocean' }] })).json()) as FeaturesResponse;
    expect(features).toEqual({});
  });

  it('answers 503 when FreqBlog is not configured, and 400 on bad input', async () => {
    expect((await setup({}, {}).call('POST', '/api/features', { tracks: [] })).status).toBe(503);
    expect((await setup().call('POST', '/api/features', { tracks: 'nope' })).status).toBe(400);
  });
});

describe('/api/spotify-details', () => {
  const byId = (status = 200, name = 'Nights') => () =>
    status === 200 ? spotifyTrack(name, 'Frank Ocean') : new Response('{}', { status });

  it('looks up tracks with a Spotify id directly, and searches for the rest', async () => {
    const { call, calls } = setup({ [`GET api.spotify.com/v1/tracks/${SPOTIFY_ID}`]: byId() });
    const res = await call('POST', '/api/spotify-details', {
      tracks: [
        { id: `spotify:track:${SPOTIFY_ID}`, title: 'Nights', artists: 'Frank Ocean' },
        { id: 'csv-2', title: 'Often', artists: 'The Weeknd' },
        { id: 'csv-3', title: 'My Unreleased Edit', artists: 'Me' },
      ],
    });
    expect(await res.json()).toEqual({
      details: {
        [`spotify:track:${SPOTIFY_ID}`]: { spotifyId: SPOTIFY_ID, img: 'https://i.scdn.co/300', dur: 307 },
        'csv-2': { spotifyId: '4PhsKqMdgMEUSstTDAmMpg', img: 'https://i.scdn.co/300', dur: 307 },
      },
    });
    const searches = calls.filter((c) => c.key === 'GET api.spotify.com/v1/search').map((c) => c.url.searchParams.get('q'));
    expect(searches).toEqual(['track:Often artist:The Weeknd', 'track:My Unreleased Edit artist:Me']);
  });

  it('falls back to search when lookup by id is refused or unknown', async () => {
    for (const status of [403, 404]) {
      const { call } = setup({ [`GET api.spotify.com/v1/tracks/${SPOTIFY_ID}`]: byId(status) });
      const res = await call('POST', '/api/spotify-details', { tracks: [{ id: 'x', spotifyId: SPOTIFY_ID, title: 'Nights', artists: 'Frank Ocean' }] });
      expect(((await res.json()) as { details: object }).details).toEqual({ x: expect.objectContaining({ spotifyId: SPOTIFY_ID }) });
    }
  });

  it('answers 503 without Spotify keys', async () => {
    expect((await setup({}, { FREQBLOG_API_KEY: 'k' }).call('POST', '/api/spotify-details', { tracks: [] })).status).toBe(503);
  });
});

describe('FreqBlog client', () => {
  it('caches hits and misses, and re-asks about queued tracks only after 10 minutes', async () => {
    let t = 0;
    const { fetch, calls } = fakeFetch({ 'GET api.freqblog.com/lookup': freqLookup });
    const fb = createFreqBlog({ env: ENV, fetch, now: () => t });
    await fb.lookup({ title: 'Nights', artists: 'Frank Ocean' });
    await fb.lookup({ title: 'Nights', artists: 'Frank Ocean' });
    await fb.lookup({ title: 'Unknown', artists: 'Me' });
    await fb.lookup({ title: 'Unknown', artists: 'Me' });
    expect(calls).toHaveLength(2);
    await fb.lookup({ title: 'Queued', artists: 'X' });
    await fb.lookup({ title: 'Queued', artists: 'X' });
    expect(calls).toHaveLength(3);
    t += 11 * 60_000;
    await fb.lookup({ title: 'Queued', artists: 'X' });
    expect(calls).toHaveLength(4);
  });

  it('waits out the in-flight limit (short Retry-After) but not the monthly quota', async () => {
    const waits: number[] = [];
    let n = 0;
    const { fetch } = fakeFetch({
      'GET api.freqblog.com/lookup': () =>
        n++ === 0 ? new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }) : FREQ.nights,
    });
    const fb = createFreqBlog({ env: ENV, fetch }, async (ms) => void waits.push(ms));
    expect(await fb.lookup({ title: 'Nights', artists: 'Frank Ocean' })).toMatchObject({ bpm: 90 });
    expect(waits).toEqual([2000]);

    const quota = fakeFetch({ 'GET api.freqblog.com/lookup': () => new Response('{}', { status: 429 }) });
    const fb2 = createFreqBlog({ env: ENV, fetch: quota.fetch });
    await expect(fb2.lookup({ title: 'Nights', artists: 'Frank Ocean' })).rejects.toMatchObject({ status: 429 });
    expect(quota.calls).toHaveLength(1);
  });
});

describe('/api/recommend', () => {
  it('suggests via Gemini, verifies on FreqBlog, and adds Spotify art', async () => {
    const { call } = setup();
    const { tracks } = (await (await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] })).json()) as TracksResponse;
    expect(tracks.map((t) => [t.title.replace(' - SPOTIFY_ONLY_SUFFIX', ''), t.bpm, t.key])).toEqual([
      ['Often', 96, '6A'],
      ['Location', 88, '9A'],
    ]);
    expect(tracks[0]).toMatchObject({ id: 'spotify:track:4PhsKqMdgMEUSstTDAmMpg', img: 'https://i.scdn.co/300' });
    expect(tracks[1]).toMatchObject({ id: 'freqblog:f-loc', img: null }); // no Spotify match: FreqBlog data only
  });

  it('never sends Spotify data to Gemini', async () => {
    const { call, calls } = setup();
    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights - SPOTIFY_ONLY_SUFFIX', artists: 'Frank Ocean' }] });
    const geminiCall = calls.find((c) => c.url.host === 'generativelanguage.googleapis.com')!;
    const sent = String(geminiCall.init.body);
    expect(sent).toContain('\\"Nights\\" by Frank Ocean — 90 BPM, key 6A (Camelot), genres: r&b');
    expect(sent).toContain('Suggest 10 real');
    expect(sent).not.toMatch(/SPOTIFY_ONLY|spotify|scdn|7eqoqGkKwgOaWNNHx90uEZ/i);
    expect(new Headers(geminiCall.init.headers).get('x-goog-api-key')).toBe('gem-key');
  });

  it('skips Gemini for seeds FreqBlog does not know, and caches results', async () => {
    const { call, calls } = setup();
    const unknown = await call('POST', '/api/recommend', { seeds: [{ title: 'My Unreleased Edit', artists: 'Me' }] });
    expect(((await unknown.json()) as TracksResponse).tracks).toEqual([]);
    expect(calls.some((c) => c.url.host === 'generativelanguage.googleapis.com')).toBe(false);

    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    expect(calls.filter((c) => c.url.host === 'generativelanguage.googleapis.com')).toHaveLength(1);
  });

  it('maps upstream failures to 502/503 and unknown routes to 404', async () => {
    const gemDown = setup({ [GEMINI]: () => new Response('{}', { status: 500 }) });
    expect((await gemDown.call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] })).status).toBe(502);
    expect((await setup({}, { FREQBLOG_API_KEY: 'k' }).call('POST', '/api/recommend', { seeds: [] })).status).toBe(503);
    expect((await setup().call('GET', '/api/nope')).status).toBe(404);
  });
});

describe('timeouts', () => {
  it('turns a hung Gemini call into a quick 504 that names the service', async () => {
    const { fetchWithTimeout } = await import('../core');
    const hang = (async (_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
    await expect(fetchWithTimeout(hang, 'Gemini', 'https://x', {}, 20)).rejects.toMatchObject({
      status: 504,
      message: "Gemini didn't respond within 0.02s",
    });
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(fetchWithTimeout(down, 'Gemini', 'https://x', {}, 20)).rejects.toMatchObject({ status: 502 });
  });

  it('reports Gemini error bodies', async () => {
    const { call } = setup({ [GEMINI]: () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }) });
    const res = await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain('API key not valid');
  });
});
