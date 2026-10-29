import { DEFAULT_TITLE, noteKey } from '../lib/plan';
import type { TrackFeatures } from '../lib/provider';
import type { PlanState, Rating, Track, TransitionNote } from '../lib/types';

export type PlanAction =
  | { type: 'load'; plan: PlanState }
  | { type: 'rename'; title: string }
  | { type: 'add'; track: Track }
  | { type: 'insertAt'; index: number; track: Track }
  | { type: 'move'; from: number; to: number }
  | { type: 'remove'; id: string } // no UI yet (not designed)
  | { type: 'fillTrackData'; patches: Record<string, TrackFeatures> }
  | { type: 'setRating'; from: string; to: string; rating: Rating }
  | { type: 'setNote'; from: string; to: string; text: string };

function withUniqueId(track: Track, tracks: Track[]): Track {
  const base = track.id.replace(/\|/g, '_');
  let id = base;
  for (let n = 2; tracks.some((t) => t.id === id); n++) id = `${base}~${n}`;
  return id === track.id ? track : { ...track, id };
}

function insert(state: PlanState, index: number, track: Track): PlanState {
  const tracks = [...state.tracks];
  tracks.splice(Math.max(0, Math.min(index, tracks.length)), 0, withUniqueId(track, tracks));
  return { ...state, tracks };
}

function updateNote(state: PlanState, from: string, to: string, patch: Partial<TransitionNote>): PlanState {
  const key = noteKey(from, to);
  const prev: TransitionNote | undefined = state.notes[key];
  const next: TransitionNote = { rating: prev?.rating ?? 0, text: prev?.text ?? '', ...patch };
  const notes = { ...state.notes };
  if (next.rating || next.text) notes[key] = next;
  else delete notes[key];
  return { ...state, notes };
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'load':
      return action.plan;
    case 'rename':
      return action.title === state.title ? state : { ...state, title: action.title };
    case 'add':
      return insert(state, state.tracks.length, action.track);
    case 'insertAt':
      return insert(state, action.index, action.track);
    case 'move': {
      const { from, to } = action;
      const n = state.tracks.length;
      if (from === to || from < 0 || to < 0 || from >= n || to >= n) return state;
      const tracks = [...state.tracks];
      const [moved] = tracks.splice(from, 1);
      tracks.splice(to, 0, moved);
      return { ...state, tracks };
    }
    case 'remove':
      // Notes stay in memory; they're dropped on save because one side is missing.
      return { ...state, tracks: state.tracks.filter((t) => t.id !== action.id) };
    case 'fillTrackData': {
      // Only fills gaps; never overwrites what the user imported or typed.
      let changed = false;
      const tracks = state.tracks.map((t) => {
        const patch = action.patches[t.id];
        if (!patch) return t;
        const next = { ...t };
        for (const k of ['bpm', 'key', 'dur', 'img', 'spotifyId'] as const) {
          if (next[k] == null && patch[k] != null) {
            (next as Record<typeof k, unknown>)[k] = patch[k];
            changed = true;
          }
        }
        if (!next.genres.length && patch.genres?.length) {
          next.genres = patch.genres;
          changed = true;
        }
        return next;
      });
      return changed ? { ...state, tracks } : state;
    }
    case 'setRating':
      return updateNote(state, action.from, action.to, { rating: action.rating });
    case 'setNote':
      return updateNote(state, action.from, action.to, { text: action.text });
  }
}

export const isDefaultTitle = (title: string) => (title.trim() || DEFAULT_TITLE) === DEFAULT_TITLE;
