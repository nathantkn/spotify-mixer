import { apiProvider } from './apiProvider';
import { mockProvider } from './mockProvider';
import type { Track } from './types';

/** Catalogue facts a provider can fill in for a track that's missing them. */
export type TrackFeatures = Partial<Pick<Track, 'bpm' | 'key' | 'dur' | 'img' | 'genres'>>;

export interface TrackProvider {
  /** Add-song search. */
  search(query: string, signal?: AbortSignal): Promise<Track[]>;
  /** Tracks that may mix well with the seeds. The app filters and ranks them itself (recommend.ts). */
  candidates(seeds: Track[], signal?: AbortSignal): Promise<Track[]>;
  /** Features for tracks the provider knows, keyed by track id. Unknown tracks are left out. */
  features(tracks: Track[]): Promise<Record<string, TrackFeatures>>;
}

// All app code goes through this. Set VITE_TRACK_PROVIDER=mock to work offline.
export const trackProvider: TrackProvider = import.meta.env.VITE_TRACK_PROVIDER === 'mock' ? mockProvider : apiProvider;
