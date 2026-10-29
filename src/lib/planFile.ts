import { parseCamelot } from './camelot';
import { ImportError } from './errors';
import { hueOf, newId } from './format';
import { DEFAULT_TITLE, noteKey, uniqueIds } from './plan';
import { clampRating } from './rating';
import type { NoteKey, PlanFileV1, PlanState, Track, TransitionNote } from './types';

/** Only notes whose two tracks are both still in the plan, and that have a rating or text. */
export function toPlanFile(plan: PlanState, updated = Date.now()): PlanFileV1 {
  const ids = new Set(plan.tracks.map((t) => t.id));
  const transitions: PlanFileV1['transitions'] = [];
  for (const [key, n] of Object.entries(plan.notes) as [NoteKey, TransitionNote][]) {
    const [from, to] = key.split('|');
    if ((n.rating || n.text) && ids.has(from) && ids.has(to)) {
      transitions.push({ from, to, rating: n.rating, note: n.text });
    }
  }
  return {
    version: 1,
    id: plan.id,
    title: plan.title.trim() || DEFAULT_TITLE,
    updated,
    tracks: plan.tracks.map(({ id, title, artists, bpm, key, dur, genres, img, hue }) => ({
      id, title, artists, bpm, key, dur, genres, img: img ?? null, hue,
    })),
    transitions,
  };
}

const positive = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Forgiving v1 reader: drops untitled tracks, nulls bad keys/BPM/durations, clamps ratings, fills ids. */
export function fromPlanFile(data: unknown): PlanState {
  if (!isRecord(data) || !Array.isArray(data.tracks)) {
    throw new ImportError('This doesn’t look like a mix plan file.');
  }
  const tracks: Track[] = data.tracks
    .filter((t): t is Record<string, unknown> => isRecord(t) && str(t.title).trim() !== '')
    .map((t) => {
      const title = str(t.title).trim();
      return {
        id: str(t.id).trim() || newId('t'),
        title,
        artists: str(t.artists).trim() || 'Unknown artist',
        bpm: positive(t.bpm),
        key: parseCamelot(t.key),
        dur: positive(t.dur),
        genres: Array.isArray(t.genres) ? t.genres.map((g) => str(g).toLowerCase().trim()).filter(Boolean) : [],
        img: str(t.img).trim() || null,
        hue: typeof t.hue === 'number' && Number.isFinite(t.hue) ? t.hue : hueOf(title),
      };
    });

  const notes: PlanState['notes'] = {};
  for (const x of Array.isArray(data.transitions) ? data.transitions : []) {
    if (!isRecord(x) || !x.from || !x.to) continue;
    const from = str(x.from).replace(/\|/g, '_');
    const to = str(x.to).replace(/\|/g, '_');
    notes[noteKey(from, to)] = { rating: clampRating(x.rating), text: str(x.note) };
  }

  return {
    id: str(data.id).trim() || newId('plan'),
    title: str(data.title).trim() || 'Imported mix',
    tracks: uniqueIds(tracks),
    notes,
  };
}

export function parsePlanJson(text: string): PlanState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('That JSON file couldn’t be read.');
  }
  return fromPlanFile(data);
}

export const serializePlan = (file: PlanFileV1) => JSON.stringify(file, null, 2);

export function planFileName(title: string): string {
  const slug = title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  return `${slug || 'mix'}.mixplan.json`;
}
