import type { FeaturesResponse, RecommendRequest, TracksResponse } from './apiTypes';
import { FEATURES_BATCH } from './apiTypes';
import { chunk, createClient } from './http';
import type { TrackFeatures, TrackProvider } from './provider';
import type { Track } from './types';

const FEATURES_KEY = 'mixplanner.features.v1';
const FEATURES_TTL = 7 * 24 * 3_600_000;
type StoredFeatures = Record<string, { f: TrackFeatures | null; t: number }>;

/**
 * Feature lookups (hits and misses) kept for a week across reloads, because FreqBlog's free tier
 * is 1,000 lookups a month. Falls back to memory when storage is unavailable.
 */
export function createFeatureStore(getStorage: () => Storage | undefined = () => globalThis.localStorage, now = Date.now) {
  let memory: StoredFeatures = {};
  try {
    const raw = getStorage()?.getItem(FEATURES_KEY);
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
        getStorage()?.setItem(FEATURES_KEY, JSON.stringify(memory));
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
): TrackProvider {
  const candidateCache = new Map<string, Promise<Track[]>>();
  const candidateResults = new Map<string, Track[]>();
  const seedKey = (seeds: Track[]) => JSON.stringify(seeds.map(({ title, artists }) => ({ title, artists })));

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

    async features(tracks) {
      const todo = tracks.filter((t) => !featureCache.has(t.id));
      for (const batch of chunk(todo, FEATURES_BATCH)) {
        const { features } = await client.post<FeaturesResponse>('/features', {
          tracks: batch.map(({ id, title, artists }) => ({ id, title, artists })),
        });
        featureCache.setMany(batch.map((t) => [t.id, features[t.id] ?? null]));
      }
      const out: Record<string, TrackFeatures> = {};
      for (const t of tracks) {
        const f = featureCache.get(t.id);
        if (f) out[t.id] = f;
      }
      return out;
    },
  };
}

export const apiProvider = createApiProvider();
