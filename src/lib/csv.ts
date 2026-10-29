import { parseCamelot, toCamelot } from './camelot';
import { ImportError } from './errors';
import { hueOf, newId } from './format';
import { uniqueIds } from './plan';
import { spotifyIdOf } from './spotifyId';
import type { Track } from './types';

/** Quote-aware CSV parser: "" escapes, commas/newlines in quotes, CRLF, leading BOM. Blank rows are dropped. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
  };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  endRow();
  return rows;
}

const HEADERS = {
  title: ['track name', 'name', 'title', 'song'],
  artists: ['artist name(s)', 'artist names', 'artists', 'artist'],
  id: ['track uri', 'spotify id', 'id'],
  dur: ['duration (ms)', 'duration_ms', 'duration'],
  bpm: ['tempo', 'bpm'],
  key: ['key'],
  mode: ['mode'],
  camelot: ['camelot', 'camelot key'],
  genres: ['genres', 'genre'],
  img: ['album image url', 'image url', 'album art'],
} as const;

/** Accepts m:ss, milliseconds (> 10000) or seconds. */
export function parseDuration(raw: string): number | null {
  const v = raw.trim();
  const mss = v.match(/^(\d+):(\d{1,2})$/);
  if (mss) return Number(mss[1]) * 60 + Number(mss[2]) || null;
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return null;
  return n > 10000 ? Math.round(n / 1000) : Math.round(n);
}

export function tracksFromCSV(text: string): Track[] {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new ImportError('This file has no track rows.');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(
    Object.entries(HEADERS).map(([field, names]) => [
      field,
      names.map((n) => header.indexOf(n)).find((i) => i > -1) ?? -1,
    ]),
  ) as Record<keyof typeof HEADERS, number>;
  if (col.title < 0) {
    throw new ImportError('Couldn’t find a “Track Name” column. Check that the first row is a header.');
  }

  const tracks: Track[] = [];
  for (const r of rows.slice(1)) {
    const get = (field: keyof typeof HEADERS) => (col[field] > -1 ? (r[col[field]] ?? '').trim() : '');
    const title = get('title');
    if (!title) continue;
    const bpm = Number(get('bpm'));
    const genres = get('genres');
    tracks.push({
      id: get('id') || newId('t'),
      title,
      // Exportify separates artists with bare commas.
      artists: get('artists').replace(/\s*,\s*/g, ', ') || 'Unknown artist',
      bpm: bpm > 0 ? Math.round(bpm) : null,
      key: parseCamelot(get('camelot')) ?? toCamelot(get('key'), get('mode')),
      dur: parseDuration(get('dur')),
      genres: genres ? genres.toLowerCase().split(',').map((g) => g.trim()).filter(Boolean) : [],
      img: get('img') || null,
      hue: hueOf(title),
      ...(spotifyIdOf(get('id')) ? { spotifyId: spotifyIdOf(get('id')) } : {}),
    });
  }
  if (!tracks.length) throw new ImportError('No tracks found — every row is missing a track name.');
  return uniqueIds(tracks);
}

/** "late_night-mix.csv" → "late night mix" */
export function titleFromFileName(name: string): string {
  return name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported mix';
}

export const CSV_TEMPLATE =
  'Track Name,Artist Name(s),Duration (ms),Tempo,Key,Mode,Genres\n' +
  'Parking Lot,"Mustard, Travis Scott",173000,100,7,0,"hip hop,trap"\n';
