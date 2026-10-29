/**
 * GetSongBPM: BPM, key and (artist) genres by title + artist.
 * Docs: https://getsongbpm.com/api. Free with a required backlink (see README), 3000 requests/hour per key.
 * Documented: /search/ (type, lookup, limit), song `tempo`, `key_of`, artist `genres`.
 * `open_key` and the exact search envelope are not confirmed, so parsing is forgiving.
 */
import { fromKeyName, fromOpenKey } from '../src/lib/camelot';
import type { SongRef } from '../src/lib/apiTypes';
import { hueOf } from '../src/lib/format';
import { buildUrl } from '../src/lib/http';
import { baseTitle, cleanArtist, cleanTitle, primaryArtist, sameSong } from '../src/lib/match';
import type { CamelotKey, Track } from '../src/lib/types';
import { ConfigError, HOUR, TtlCache, UpstreamError, type Deps } from './core';

/** A song as GetSongBPM knows it. This, and only this, is what may be sent to Gemini. */
export interface GsbSong {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  bpm: number | null;
  key: CamelotKey | null;
}

const DEFAULT_BASE = 'https://api.getsong.co';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function parseSong(raw: unknown): GsbSong | null {
  if (!isObject(raw)) return null;
  const title = str(raw.title);
  const id = str(raw.id);
  if (!title || !id) return null;
  const artist = isObject(raw.artist) ? raw.artist : {};
  const tempo = Number(raw.tempo);
  return {
    id,
    title,
    artist: str(artist.name) || 'Unknown artist',
    genres: Array.isArray(artist.genres) ? artist.genres.map((g) => str(g).toLowerCase()).filter(Boolean) : [],
    bpm: Number.isFinite(tempo) && tempo > 0 ? Math.round(tempo) : null,
    key: fromOpenKey(raw.open_key) ?? fromKeyName(raw.key_of),
  };
}

/** `{search: [...]}` on success; `{search: {error: ...}}` when nothing matched. */
export function parseSearch(body: unknown): GsbSong[] {
  const list = isObject(body) ? body.search : body;
  return Array.isArray(list) ? list.map(parseSong).filter((s): s is GsbSong => s !== null) : [];
}

export function gsbToTrack(s: GsbSong): Track {
  return {
    id: `getsongbpm:${s.id}`,
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

export function createGetSongBpm({ env, fetch, now }: Deps) {
  const base = env.GETSONGBPM_BASE_URL || DEFAULT_BASE;
  // Song facts rarely change; caching protects the hourly quota.
  const lookups = new TtlCache<GsbSong | null>(24 * HOUR, 2000, now);
  const configured = Boolean(env.GETSONGBPM_API_KEY);

  async function searchSongs(lookup: string, type: 'song' | 'both', limit = 10): Promise<GsbSong[]> {
    if (!env.GETSONGBPM_API_KEY) throw new ConfigError('GETSONGBPM_API_KEY is not set');
    const res = await fetch(buildUrl(base, '/search/', { type, lookup, limit }), {
      headers: { 'X-API-KEY': env.GETSONGBPM_API_KEY, Accept: 'application/json' },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new UpstreamError('GetSongBPM', res.status);
    return parseSearch(await res.json());
  }

  /** The GetSongBPM entry for a song, or null if it isn't a confident match. */
  async function lookup(ref: SongRef): Promise<GsbSong | null> {
    const artist = primaryArtist(ref.artists);
    const key = `${cleanTitle(ref.title)}|${cleanArtist(artist)}`;
    const cached = lookups.get(key);
    if (cached !== undefined) return cached;
    const results = await searchSongs(`song:${baseTitle(ref.title)} artist:${artist}`, 'both');
    const match = results.find((s) => sameSong(ref, { title: s.title, artists: s.artist })) ?? null;
    lookups.set(key, match);
    return match;
  }

  return { configured, searchSongs, lookup };
}

export type GetSongBpm = ReturnType<typeof createGetSongBpm>;
