import { newId } from './format';
import type { NoteKey, PlanState, Track } from './types';

export const DEFAULT_TITLE = 'Untitled mix';

export const noteKey = (fromId: string, toId: string): NoteKey => `${fromId}|${toId}`;

export function emptyPlan(): PlanState {
  return { id: newId('plan'), title: DEFAULT_TITLE, tracks: [], notes: {} };
}

/** Average rating over the neighbouring pairs in the current order; null when none are rated. */
export function avgMix(plan: Pick<PlanState, 'tracks' | 'notes'>): number | null {
  const rated: number[] = [];
  for (let i = 0; i < plan.tracks.length - 1; i++) {
    const r = plan.notes[noteKey(plan.tracks[i].id, plan.tracks[i + 1].id)]?.rating;
    if (r) rated.push(r);
  }
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
}

export const totalSeconds = (tracks: Track[]) => tracks.reduce((sum, t) => sum + (t.dur ?? 0), 0);

/** Ids are used as React keys, sortable ids and note keys, so they must be unique and pipe-free. */
export function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const base = item.id.replace(/\|/g, '_');
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}~${n}`;
    seen.add(id);
    return id === item.id ? item : { ...item, id };
  });
}
