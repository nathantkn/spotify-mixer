export type CamelotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type CamelotKey = `${CamelotNumber}${'A' | 'B'}`;

export interface Track {
  /** Spotify Track URI from the CSV when present; otherwise generated. */
  id: string;
  title: string;
  /** Display string, ", "-separated. */
  artists: string;
  /** Rounded integer. */
  bpm: number | null;
  key: CamelotKey | null;
  /** Seconds. */
  dur: number | null;
  /** Lowercase. */
  genres: string[];
  img?: string | null;
  /** Fallback art hue. */
  hue: number;
}

export type Rating = 0 | 1 | 2 | 3 | 4 | 5;

/** rating 0 = unrated */
export interface TransitionNote {
  rating: Rating;
  text: string;
}

export type NoteKey = `${string}|${string}`;

export interface PlanState {
  id: string;
  title: string;
  tracks: Track[];
  /** Keyed by `${fromId}|${toId}`, not by position. Orphaned notes are kept in memory. */
  notes: Record<NoteKey, TransitionNote>;
}

/** `.mixplan.json`, schema v1 */
export interface PlanFileV1 {
  version: 1;
  id: string;
  title: string;
  updated: number;
  tracks: Track[];
  transitions: { from: string; to: string; rating: Rating; note: string }[];
}
