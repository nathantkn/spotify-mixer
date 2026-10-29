/** The three /api endpoints. Shared by the Vercel functions (api/) and the Vite dev server. */
import {
  FEATURES_BATCH,
  type ApiErrorBody,
  type FeaturesRequest,
  type FeaturesResponse,
  type RecommendRequest,
  type SongRef,
  type TracksResponse,
} from '../src/lib/apiTypes';
import type { Track } from '../src/lib/types';
import { BadRequest, ConfigError, HOUR, mapLimit, TtlCache, UpstreamError, type Deps } from './core';
import { createGemini, type Gemini } from './gemini';
import { createGetSongBpm, gsbToTrack, type GetSongBpm, type GsbSong } from './getsongbpm';
import { createSpotify, type Spotify } from './spotify';

export interface Services {
  gsb: GetSongBpm;
  spotify: Spotify;
  gemini: Gemini;
  recommendations: TtlCache<Track[]>;
}

export function createServices(deps: Deps): Services {
  return {
    gsb: createGetSongBpm(deps),
    spotify: createSpotify(deps),
    gemini: createGemini(deps),
    recommendations: new TtlCache<Track[]>(6 * HOUR, 300, deps.now),
  };
}

const SEARCH_RESULTS = 8;

const json = <T>(body: T, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const fail = (status: number, error: string) => json<ApiErrorBody>({ error }, status);

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BadRequest('Body must be JSON');
  }
}

function songRefs(value: unknown, max: number): SongRef[] {
  if (!Array.isArray(value)) throw new BadRequest('Expected an array of songs');
  return value
    .slice(0, max)
    .filter((s) => s && typeof s.title === 'string' && s.title.trim())
    .map((s) => ({ ...s, title: String(s.title), artists: String(s.artists ?? '') }));
}

/** GetSongBPM facts onto a track; quietly keeps the track as-is if the lookup fails. */
async function withGsb(gsb: GetSongBpm, t: Track): Promise<Track> {
  if (!gsb.configured) return t;
  const s = await gsb.lookup(t).catch(() => null);
  return s ? { ...t, bpm: s.bpm, key: s.key, genres: s.genres } : t;
}

async function search(svc: Services, q: string): Promise<Track[]> {
  if (!q.trim()) return [];
  if (svc.spotify.configured) {
    try {
      const found = (await svc.spotify.search(q, 10)).slice(0, SEARCH_RESULTS);
      return await mapLimit(found, 3, (t) => withGsb(svc.gsb, t));
    } catch (e) {
      // 401/403: app-only Spotify access refused (Spotify is moving away from it). Fall back below.
      if (!(e instanceof UpstreamError && (e.status === 401 || e.status === 403))) throw e;
    }
  }
  return (await svc.gsb.searchSongs(q, 'song', SEARCH_RESULTS)).map(gsbToTrack);
}

async function features(svc: Services, body: FeaturesRequest): Promise<FeaturesResponse> {
  if (!svc.gsb.configured) throw new ConfigError('GETSONGBPM_API_KEY is not set');
  const tracks = songRefs(body?.tracks, FEATURES_BATCH) as FeaturesRequest['tracks'];
  const found = await mapLimit(tracks, 4, (t) => svc.gsb.lookup(t).catch(() => null));
  const out: FeaturesResponse['features'] = {};
  tracks.forEach((t, i) => {
    const s = found[i];
    if (s && typeof t.id === 'string') out[t.id] = { bpm: s.bpm, key: s.key, genres: s.genres };
  });
  return { features: out };
}

/**
 * Seeds → their GetSongBPM entries → Gemini suggestions (from GetSongBPM data only) →
 * each suggestion verified on GetSongBPM (real BPM/key; invented songs drop out) → Spotify for art.
 * The app then filters and ranks these with its own key/BPM/genre score.
 */
async function recommend(svc: Services, body: RecommendRequest): Promise<Track[]> {
  if (!svc.gsb.configured) throw new ConfigError('GETSONGBPM_API_KEY is not set');
  if (!svc.gemini.configured) throw new ConfigError('GEMINI_API_KEY is not set');
  const refs = songRefs(body?.seeds, 2);
  const seeds = (await mapLimit(refs, 2, (s) => svc.gsb.lookup(s))).filter((s): s is GsbSong => s !== null);
  if (!seeds.length) return []; // not in GetSongBPM, so nothing trustworthy to prompt with

  const cacheKey = seeds.map((s) => s.id).join('|');
  const cached = svc.recommendations.get(cacheKey);
  if (cached) return cached;

  const suggestions = await svc.gemini.suggest(seeds);
  const verified = await mapLimit(suggestions, 4, (s) => svc.gsb.lookup(s).catch(() => null));
  const seen = new Set(seeds.map((s) => s.id));
  const unique = verified.filter((s): s is GsbSong => {
    if (!s || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  const tracks = await mapLimit(unique, 4, async (s) => {
    const sp = svc.spotify.configured
      ? await svc.spotify.find({ title: s.title, artists: s.artist }).catch(() => null)
      : null;
    return sp ? { ...sp, bpm: s.bpm, key: s.key, genres: s.genres } : gsbToTrack(s);
  });
  svc.recommendations.set(cacheKey, tracks);
  return tracks;
}

export async function handleApi(request: Request, svc: Services): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
  try {
    switch (route) {
      case 'GET /api/search':
        return json<TracksResponse>({ tracks: await search(svc, url.searchParams.get('q') ?? '') });
      case 'POST /api/features':
        return json<FeaturesResponse>(await features(svc, await readJson(request)));
      case 'POST /api/recommend':
        return json<TracksResponse>({ tracks: await recommend(svc, await readJson(request)) });
      default:
        return fail(404, `No route for ${route}`);
    }
  } catch (e) {
    if (e instanceof BadRequest) return fail(400, e.message);
    if (e instanceof ConfigError) return fail(503, e.message);
    if (e instanceof UpstreamError) return fail(e.status === 429 ? 503 : 502, e.message);
    console.error(e);
    return fail(500, 'Something went wrong');
  }
}
