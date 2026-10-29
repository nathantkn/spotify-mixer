/** Request/response shapes of our own /api functions (shared by the app and server/). */
import type { TrackFeatures } from './provider';
import type { Track } from './types';

export interface SongRef {
  title: string;
  artists: string;
}

export interface TracksResponse {
  tracks: Track[];
}

export interface FeaturesRequest {
  tracks: (SongRef & { id: string })[];
}
export interface FeaturesResponse {
  features: Record<string, TrackFeatures>;
}

export interface SpotifyDetailsRequest {
  tracks: (SongRef & { id: string; spotifyId?: string | null })[];
}
export interface SpotifyDetailsResponse {
  details: Record<string, Pick<TrackFeatures, 'spotifyId' | 'img' | 'dur'>>;
}

export interface RecommendRequest {
  seeds: SongRef[];
}

export interface ApiErrorBody {
  error: string;
}

/** Most tracks per /api/features or /api/spotify-details call, so one call stays well inside function time limits. */
export const FEATURES_BATCH = 20;
