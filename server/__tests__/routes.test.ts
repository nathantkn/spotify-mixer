import { describe, expect, it } from 'vitest';
import type { FeaturesResponse, TracksResponse } from '../../src/lib/apiTypes';
import type { ServerEnv } from '../core';
import { createServices, handleApi } from '../routes';
import { fakeFetch, type Route } from './fakeFetch';

const ENV: ServerEnv = {
  SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', GETSONGBPM_API_KEY: 'gsb-key', GEMINI_API_KEY: 'gem-key',
};
const SPOTIFY_ID = '7eqoqGkKwgOaWNNHx90uEZ';

/** GetSongBPM's catalogue in this test. */
const GSB: Record<string, object> = {
  nights: { id: 'g-nights', title: 'Nights', tempo: '90', open_key: '11m', artist: { name: 'Frank Ocean', genres: ['R&B'] } },
  often: { id: 'g-often', title: 'Often', tempo: '96', key_of: 'Gm', artist: { name: 'The Weeknd', genres: ['r&b'] } },
  location: { id: 'g-loc', title: 'Location', tempo: '88', key_of: 'Dm', artist: { name: 'Khalid', genres: ['r&b', 'pop'] } },
};

const gsbSearch: Route = (url) => {
  const lookup = (url.searchParams.get('lookup') ?? '').toLowerCase();
  const hits = Object.entries(GSB).filter(([k]) => lookup.includes(k)).map(([, v]) => v);
  return { search: hits.length ? hits : { error: 'no result' } };
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
    'GET api.getsong.co/search/': gsbSearch,
    'POST generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent': () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify([
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
  return { call, calls };
}

describe('/api/search', () => {
  it('finds songs on Spotify and adds BPM, key and genres from GetSongBPM', async () => {
    const { call, calls } = setup();
    const res = await call('GET', '/api/search?q=nights');
    const { tracks } = (await res.json()) as TracksResponse;
    expect(tracks[0]).toMatchObject({
      id: `spotify:track:${SPOTIFY_ID}`, artists: 'Frank Ocean', dur: 307, img: 'https://i.scdn.co/300',
      bpm: 90, key: '6A', genres: ['r&b'],
    });
    const spotifyCall = calls.find((c) => c.key === 'GET api.spotify.com/v1/search')!;
    expect(spotifyCall.url.searchParams.get('limit')).toBe('10');
    expect(new Headers(spotifyCall.init.headers).get('Authorization')).toBe('Bearer tok');
    expect(new Headers(calls.find((c) => c.key === 'GET api.getsong.co/search/')!.init.headers).get('X-API-KEY')).toBe('gsb-key');
  });

  it('falls back to GetSongBPM search when Spotify refuses app-only access', async () => {
    const { call } = setup({ 'GET api.spotify.com/v1/search': () => new Response('{}', { status: 403 }) });
    const { tracks } = (await (await call('GET', '/api/search?q=often')).json()) as TracksResponse;
    expect(tracks).toEqual([expect.objectContaining({ id: 'getsongbpm:g-often', title: 'Often', bpm: 96, key: '6A' })]);
  });

  it('works with only a GetSongBPM key', async () => {
    const { call, calls } = setup({}, { GETSONGBPM_API_KEY: 'k' });
    const { tracks } = (await (await call('GET', '/api/search?q=location')).json()) as TracksResponse;
    expect(tracks[0]).toMatchObject({ title: 'Location', key: '7A' });
    expect(calls.some((c) => c.url.host.includes('spotify'))).toBe(false);
  });
});

describe('/api/features', () => {
  it('returns features for matched tracks only', async () => {
    const { call } = setup();
    const res = await call('POST', '/api/features', {
      tracks: [
        { id: 'spotify:track:a', title: 'Nights', artists: 'Frank Ocean' },
        { id: 'm1', title: 'My Unreleased Edit', artists: 'Me' },
      ],
    });
    const { features } = (await res.json()) as FeaturesResponse;
    expect(features).toEqual({ 'spotify:track:a': { bpm: 90, key: '6A', genres: ['r&b'] } });
  });

  it('answers 503 when GetSongBPM is not configured, and 400 on bad input', async () => {
    expect((await setup({}, {}).call('POST', '/api/features', { tracks: [] })).status).toBe(503);
    expect((await setup().call('POST', '/api/features', { tracks: 'nope' })).status).toBe(400);
  });
});

describe('/api/recommend', () => {
  it('suggests via Gemini, verifies on GetSongBPM, and adds Spotify art', async () => {
    const { call } = setup();
    const res = await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    const { tracks } = (await res.json()) as TracksResponse;
    expect(tracks.map((t) => [t.title.replace(' - SPOTIFY_ONLY_SUFFIX', ''), t.bpm, t.key])).toEqual([
      ['Often', 96, '6A'],
      ['Location', 88, '7A'],
    ]);
    expect(tracks[0]).toMatchObject({ id: 'spotify:track:4PhsKqMdgMEUSstTDAmMpg', img: 'https://i.scdn.co/300' });
    expect(tracks[1]).toMatchObject({ id: 'getsongbpm:g-loc', img: null }); // no Spotify match: GetSongBPM data only
  });

  it('never sends Spotify data to Gemini', async () => {
    const { call, calls } = setup();
    // The seed as the app knows it, with Spotify's spelling.
    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights - SPOTIFY_ONLY_SUFFIX', artists: 'Frank Ocean' }] });
    const geminiCall = calls.find((c) => c.url.host === 'generativelanguage.googleapis.com')!;
    const sent = String(geminiCall.init.body);
    expect(sent).toContain('\\"Nights\\" by Frank Ocean — 90 BPM, key 6A (Camelot), genres: r&b');
    expect(sent).not.toMatch(/SPOTIFY_ONLY|spotify|scdn|7eqoqGkKwgOaWNNHx90uEZ/i);
    expect(new Headers(geminiCall.init.headers).get('x-goog-api-key')).toBe('gem-key');
  });

  it('skips Gemini for seeds GetSongBPM does not know, and caches results', async () => {
    const { call, calls } = setup();
    const unknown = await call('POST', '/api/recommend', { seeds: [{ title: 'My Unreleased Edit', artists: 'Me' }] });
    expect(((await unknown.json()) as TracksResponse).tracks).toEqual([]);
    expect(calls.some((c) => c.url.host === 'generativelanguage.googleapis.com')).toBe(false);

    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    await call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] });
    expect(calls.filter((c) => c.url.host === 'generativelanguage.googleapis.com')).toHaveLength(1);
  });

  it('maps upstream failures to 502/503 and unknown routes to 404', async () => {
    const gemDown = setup({
      'POST generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent': () => new Response('{}', { status: 500 }),
    });
    expect((await gemDown.call('POST', '/api/recommend', { seeds: [{ title: 'Nights', artists: 'Frank Ocean' }] })).status).toBe(502);
    expect((await setup({}, { GETSONGBPM_API_KEY: 'k' }).call('POST', '/api/recommend', { seeds: [] })).status).toBe(503);
    expect((await setup().call('GET', '/api/nope')).status).toBe(404);
  });
});
