import type { FeaturesResponse, RecommendRequest, TracksResponse } from './apiTypes';
import { FEATURES_BATCH } from './apiTypes';
import { chunk, createClient } from './http';
import type { TrackFeatures, TrackProvider } from './provider';
import type { Track } from './types';

/**
 * Talks to our own /api functions (server/), which hold the Spotify, GetSongBPM and Gemini keys.
 * Results are cached for the session, since every upstream call counts against a quota.
 */
export function createApiProvider(client = createClient({ baseUrl: '/api' })): TrackProvider {
  const featureCache = new Map<string, TrackFeatures | null>();
  const candidateCache = new Map<string, Promise<Track[]>>();

  return {
    async search(query, signal) {
      const q = query.trim();
      if (!q) return [];
      return (await client.get<TracksResponse>('/search', { q }, signal)).tracks;
    },

    candidates(seeds) {
      const body: RecommendRequest = { seeds: seeds.map(({ title, artists }) => ({ title, artists })) };
      if (!body.seeds.length) return Promise.resolve([]);
      const key = JSON.stringify(body.seeds);
      let pending = candidateCache.get(key);
      if (!pending) {
        pending = client.post<TracksResponse>('/recommend', body).then((r) => r.tracks);
        pending.catch(() => candidateCache.delete(key)); // don't cache failures
        candidateCache.set(key, pending);
      }
      return pending;
    },

    async features(tracks) {
      const todo = tracks.filter((t) => !featureCache.has(t.id));
      for (const batch of chunk(todo, FEATURES_BATCH)) {
        const { features } = await client.post<FeaturesResponse>('/features', {
          tracks: batch.map(({ id, title, artists }) => ({ id, title, artists })),
        });
        for (const t of batch) featureCache.set(t.id, features[t.id] ?? null);
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
