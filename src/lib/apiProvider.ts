import type { FeaturesResponse, RecommendRequest, SpotifyDetailsResponse, TracksResponse } from './apiTypes';
import { FEATURES_BATCH } from './apiTypes';
import { chunk, createClient } from './http';
import type { TrackFeatures, TrackProvider } from './provider';
import type { Track } from './types';

const FEATURES_KEY = 'mixplanner.features.v1';
const SPOTIFY_KEY = 'mixplanner.spotify.v1';
const FEATURES_TTL = 7 * 24 * 3_600_000;
type StoredFeatures = Record<string, { f: TrackFeatures | null; t: number }>;

/**
 * Lookups (hits and misses) kept for a week across reloads, because FreqBlog's free tier is
 * 1,000 lookups a month and Spotify's quota is per developer account. Falls back to memory.
 */
export function createFeatureStore(
  getStorage: () => Storage | undefined = () => globalThis.localStorage,
  now = Date.now,
  storageKey = FEATURES_KEY,
) {
  let memory: StoredFeatures = {};
  try {
    const raw = getStorage()?.getItem(storageKey);
    if (raw) memory = JSON.parse(raw) as StoredFeatures;
  } catch {
    /* unavailable or corrupt: start empty */
  }
  const fresh = (id: string) => {
    const e = memory[id];
    return e && now() - e.t < FEATURES_TTL ? e : undefined;
  };
  return {
    has: (id: string) => fresh(id) !== undefined,
    get: (id: string) => fresh(id)?.f ?? null,
    setMany(entries: [string, TrackFeatures | null][]) {
      const t = now();
      for (const [id, f] of entries) memory[id] = { f, t };
      for (const id of Object.keys(memory)) if (!fresh(id)) delete memory[id];
      try {
        getStorage()?.setItem(storageKey, JSON.stringify(memory));
      } catch {
        /* keep working in memory */
      }
    },
  };
}

/**
 * Talks to our own /api functions (server/), which hold the Spotify, FreqBlog and Gemini keys.
 * Results are cached, since every upstream call counts against a quota.
 */
export function createApiProvider(
  client = createClient({ baseUrl: '/api' }),
  featureCache = createFeatureStore(),
  spotifyCache = createFeatureStore(undefined, undefined, SPOTIFY_KEY),
): TrackProvider {
  const candidateCache = new Map<string, Promise<Track[]>>();
  const candidateResults = new Map<string, Track[]>();
  const seedKey = (seeds: Track[]) => JSON.stringify(seeds.map(({ title, artists }) => ({ title, artists })));

  /** Batched POST to an /api lookup route, answered from `cache` where possible. */
  async function cachedLookup(
    cache: ReturnType<typeof createFeatureStore>,
    path: string,
    tracks: Track[],
    pick: (r: unknown) => Record<string, TrackFeatures>,
    fields: (t: Track) => object,
  ): Promise<Record<string, TrackFeatures>> {
    const todo = tracks.filter((t) => !cache.has(t.id));
    for (const batch of chunk(todo, FEATURES_BATCH)) {
      const found = pick(await client.post<unknown>(path, { tracks: batch.map(fields) }));
      cache.setMany(batch.map((t) => [t.id, found[t.id] ?? null]));
    }
    const out: Record<string, TrackFeatures> = {};
    for (const t of tracks) {
      const f = cache.get(t.id);
      if (f) out[t.id] = f;
    }
    return out;
  }

  return {
    async search(query, signal) {
      const q = query.trim();
      if (!q) return [];
      return (await client.get<TracksResponse>('/search', { q }, signal)).tracks;
    },

    candidates(seeds) {
      const body: RecommendRequest = { seeds: seeds.map(({ title, artists }) => ({ title, artists })) };
      if (!body.seeds.length) return Promise.resolve([]);
      const key = seedKey(seeds);
      let pending = candidateCache.get(key);
      if (!pending) {
        pending = client.post<TracksResponse>('/recommend', body).then((r) => {
          candidateResults.set(key, r.tracks);
          return r.tracks;
        });
        pending.catch(() => candidateCache.delete(key)); // don't cache failures
        candidateCache.set(key, pending);
      }
      return pending;
    },

    cachedCandidates(seeds) {
      return candidateResults.get(seedKey(seeds)) ?? null;
    },

    features(tracks) {
      return cachedLookup(featureCache, '/features', tracks, (r) => (r as FeaturesResponse).features, ({ id, title, artists }) => ({ id, title, artists }));
    },

    spotifyDetails(tracks) {
      return cachedLookup(
        spotifyCache,
        '/spotify-details',
        tracks,
        (r) => (r as SpotifyDetailsResponse).details,
        ({ id, title, artists, spotifyId }) => ({ id, title, artists, spotifyId }),
      );
    },
  };
}

export const apiProvider = createApiProvider();
