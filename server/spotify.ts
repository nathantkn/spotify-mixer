/**
 * Spotify Web API, used only to find songs (title, artists, length, art, id).
 * App-only (client credentials) token; the secret never leaves the server.
 * Development-mode limits since Feb 2026: search returns at most 10 results, quota is per developer account.
 * Spotify data must never be passed to Gemini (Developer Policy III.14), so nothing here feeds a prompt.
 */
import type { SongRef } from '../src/lib/apiTypes';
import { hueOf } from '../src/lib/format';
import { buildUrl } from '../src/lib/http';
import { baseTitle, primaryArtist, sameSong } from '../src/lib/match';
import { trackIdFor } from '../src/lib/spotifyId';
import type { Track } from '../src/lib/types';
import { ConfigError, createLimiter, fetchWithTimeout, sleep as defaultSleep, UpstreamError, type Deps } from './core';

interface SpotifyImage { url: string; width?: number | null }
interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms?: number;
  artists?: { name: string }[];
  album?: { images?: SpotifyImage[] };
}

/** Smallest image that's still sharp at 2× the 44px art size. */
function pickImage(images: SpotifyImage[] = []): string | null {
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= 88) ?? sorted.at(-1))?.url ?? null;
}

export function toTrack(t: SpotifyTrack): Track {
  return {
    id: trackIdFor(t.id),
    title: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(', ') || 'Unknown artist',
    bpm: null,
    key: null,
    dur: t.duration_ms ? Math.round(t.duration_ms / 1000) : null,
    genres: [],
    img: pickImage(t.album?.images),
    hue: hueOf(t.name),
    spotifyId: t.id,
  };
}

export function createSpotify({ env, fetch, now = Date.now }: Deps, sleep = defaultSleep) {
  const configured = Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
  let token: { value: string; expires: number } | null = null;
  // Imports can look up many tracks; keep bursts small (quota is per developer account).
  const limit = createLimiter(4);

  /** GET with the app token: refreshes an expired token once, waits out a short 429 once. */
  async function apiGet(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await limit(async () =>
        fetchWithTimeout(fetch, 'Spotify', url, { headers: { Authorization: `Bearer ${await getToken()}` } }, 8_000),
      );
      if (res.status === 401 && attempt === 0) {
        token = null; // expired early; get a fresh one once
        continue;
      }
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (res.status === 429 && retryAfter > 0 && retryAfter <= 5 && attempt < 2) {
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    }
  }

  async function getToken(): Promise<string> {
    if (!configured) throw new ConfigError('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set');
    if (token && token.expires > now()) return token.value;
    const res = await fetchWithTimeout(fetch, 'Spotify', 'https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }, 8_000);
    if (!res.ok) throw new UpstreamError('Spotify', res.status);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, expires: now() + (body.expires_in - 60) * 1000 };
    return token.value;
  }

  async function search(q: string, max = 10): Promise<Track[]> {
    const res = await apiGet(buildUrl('https://api.spotify.com', '/v1/search', { q, type: 'track', limit: Math.min(max, 10) }));
    if (!res.ok) throw new UpstreamError('Spotify', res.status);
    const body = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } };
    return (body.tracks?.items ?? []).filter((t) => t?.id && t.name).map(toTrack);
  }

  /** One track by Spotify id (the batch endpoint is gone for development-mode apps); null if unknown. */
  async function getTrack(spotifyId: string): Promise<Track | null> {
    const res = await apiGet(`https://api.spotify.com/v1/tracks/${encodeURIComponent(spotifyId)}`);
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new UpstreamError('Spotify', res.status);
    const t = (await res.json()) as SpotifyTrack;
    return t?.id && t.name ? toTrack(t) : null;
  }

  /** The Spotify entry for a known song, for its art, length and id. */
  async function find(ref: SongRef): Promise<Track | null> {
    const found = await search(`track:${baseTitle(ref.title)} artist:${primaryArtist(ref.artists)}`, 5);
    return found.find((t) => sameSong(ref, t)) ?? null;
  }

  return { configured, search, find, getTrack };
}

export type Spotify = ReturnType<typeof createSpotify>;
