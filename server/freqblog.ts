/**
 * FreqBlog: BPM and key (Camelot) for a song by track + artist name.
 * Docs: https://api.freqblog.com/docs. Auth: `X-Api-Key` header.
 * Free tier: 1,000 requests/month and at most 6 in flight (extra ones get 429 + Retry-After: 2).
 * A track not in the catalogue yet answers 202 ("queued") and is ready later.
 * Documented: GET /lookup?track=&artist=, fields bpm / camelot / open_key / key. Whether the fields are
 * flat or nested under `audio_features`, and whether there are genres, isn't confirmed, so parsing is forgiving.
 */
import { fromKeyName, fromOpenKey, parseCamelot } from '../src/lib/camelot';
import type { SongRef } from '../src/lib/apiTypes';
import { hueOf } from '../src/lib/format';
import { buildUrl } from '../src/lib/http';
import { baseTitle, cleanArtist, cleanTitle, primaryArtist, sameSong } from '../src/lib/match';
import type { CamelotKey, Track } from '../src/lib/types';
import {
  ConfigError,
  createLimiter,
  fetchWithTimeout,
  HOUR,
  MINUTE,
  sleep as defaultSleep,
  TtlCache,
  UpstreamError,
  type Deps,
} from './core';

/** A song as FreqBlog knows it. This, and only this, is what may be sent to Gemini. */
export interface FreqSong {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  bpm: number | null;
  key: CamelotKey | null;
}

const DEFAULT_BASE = 'https://api.freqblog.com';
/** Free accounts allow 6 requests in flight; keep one spare. */
const IN_FLIGHT = 5;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function names(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (isObject(x) ? str(x.name) : str(x))).filter(Boolean).join(', ');
  return isObject(v) ? str(v.name) : str(v);
}

function genreList(v: unknown): string[] {
  const list = Array.isArray(v) ? v.map(str) : typeof v === 'string' ? v.split(',') : [];
  return list.map((g) => g.trim().toLowerCase()).filter(Boolean);
}

/** A /lookup body → FreqSong. Accepts a flat object, `audio_features` nesting, or a `data`/`result` wrapper. */
export function parseLookup(body: unknown, ref?: SongRef): FreqSong | null {
  const root = isObject(body) ? body : null;
  if (!root) return null;
  const obj = [root.data, root.result, root.track].find(isObject) ?? root;
  const f = isObject(obj.audio_features) ? { ...obj, ...obj.audio_features } : obj;

  const bpmRaw = Number(f.bpm ?? f.tempo);
  const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? Math.round(bpmRaw) : null;
  const key = parseCamelot(f.camelot) ?? fromOpenKey(f.open_key) ?? fromKeyName(f.key);
  if (bpm == null && key == null) return null;

  const title = str(obj.title ?? obj.track_name ?? obj.name ?? (typeof obj.track === 'string' ? obj.track : '')) || ref?.title || '';
  const artist = names(obj.artists ?? obj.artist ?? obj.artist_name) || (ref ? primaryArtist(ref.artists) : '');
  if (!title) return null;
  return {
    id: str(obj.id ?? obj.isrc ?? obj.mbid ?? obj.spotify_id) || `${cleanTitle(title)}|${cleanArtist(artist)}`,
    title,
    artist: artist || 'Unknown artist',
    genres: genreList(f.genres ?? f.genre),
    bpm,
    key,
  };
}

export function freqToTrack(s: FreqSong): Track {
  return {
    id: `freqblog:${s.id}`,
    title: s.title,
    artists: s.artist,
    bpm: s.bpm,
    key: s.key,
    dur: null,
    genres: s.genres,
    img: null,
    hue: hueOf(s.title),
  };
}

export function createFreqBlog({ env, fetch, now }: Deps, sleep = defaultSleep) {
  const base = env.FREQBLOG_BASE_URL || DEFAULT_BASE;
  const configured = Boolean(env.FREQBLOG_API_KEY);
  // Every lookup counts against a small monthly quota, so cache hard (misses too).
  const lookups = new TtlCache<FreqSong | null>(24 * HOUR, 5000, now);
  const limit = createLimiter(IN_FLIGHT);

  async function request(params: Record<string, string>): Promise<Response> {
    if (!env.FREQBLOG_API_KEY) throw new ConfigError('FREQBLOG_API_KEY is not set');
    const url = buildUrl(base, '/lookup', params);
    for (let attempt = 0; ; attempt++) {
      const res = await limit(() =>
        fetchWithTimeout(fetch, 'FreqBlog', url, { headers: { 'X-Api-Key': env.FREQBLOG_API_KEY!, Accept: 'application/json' } }, 10_000),
      );
      // A short Retry-After is the in-flight limit; a long or missing one is the monthly quota.
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (res.status === 429 && retryAfter > 0 && retryAfter <= 5 && attempt < 2) {
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    }
  }

  /**
   * The FreqBlog entry for a song, or null if it's unknown, still queued, or a different song.
   * `verify: false` skips the same-song check (for a free-text search fallback).
   */
  async function lookup(ref: SongRef, { verify = true } = {}): Promise<FreqSong | null> {
    const artist = primaryArtist(ref.artists);
    const cacheKey = `${cleanTitle(ref.title)}|${cleanArtist(artist)}|${verify}`;
    const cached = lookups.get(cacheKey);
    if (cached !== undefined) return cached;

    const res = await request(artist ? { track: baseTitle(ref.title), artist } : { track: baseTitle(ref.title) });
    if (res.status === 202) {
      lookups.set(cacheKey, null, 10 * MINUTE); // queued: ask again later
      return null;
    }
    if (res.status === 404) {
      lookups.set(cacheKey, null);
      return null;
    }
    if (!res.ok) throw new UpstreamError('FreqBlog', res.status);

    let song = parseLookup(await res.json(), ref);
    if (song && verify && !sameSong(ref, { title: song.title, artists: song.artist })) song = null;
    lookups.set(cacheKey, song);
    return song;
  }

  return { configured, lookup };
}

export type FreqBlog = ReturnType<typeof createFreqBlog>;
