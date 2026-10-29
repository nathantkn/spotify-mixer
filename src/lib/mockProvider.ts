import type { TrackProvider } from './provider';
import type { CamelotKey, Track } from './types';

const L: [string, string, number, CamelotKey, string[]][] = [
  ['Nights', 'Frank Ocean', 100, '6A', ['r&b']], ['Passionfruit', 'Drake', 99, '6A', ['hip hop', 'r&b']],
  ['Poetic Justice', 'Kendrick Lamar, Drake', 100, '7A', ['hip hop']], ['squabble up', 'Kendrick Lamar', 100, '7A', ['hip hop']],
  ['Location', 'Khalid', 96, '7A', ['r&b']], ['Often', 'The Weeknd', 96, '10A', ['r&b', 'pop']],
  ['Come Through', 'H.E.R., Chris Brown', 100, '11A', ['r&b']], ['Peaches & Eggplants', 'Young Nudy, 21 Savage', 100, '12A', ['hip hop', 'trap']],
  ['Passion', 'Yung Bleu, Drake', 102, '6A', ['hip hop', 'r&b']], ['Essence', 'WizKid, Tems', 104, '8A', ['afrobeats', 'r&b']],
  ['Calm Down', 'Rema, Selena Gomez', 107, '4A', ['afrobeats']], ['Self Control', 'Frank Ocean', 80, '10A', ['r&b']],
  ['Pink + White', 'Frank Ocean', 160, '10A', ['r&b']], ['Controlla', 'Drake', 122, '7A', ['hip hop']],
  ['Hotline Bling', 'Drake', 135, '6A', ['hip hop', 'r&b']], ['Money Trees', 'Kendrick Lamar, Jay Rock', 144, '8A', ['hip hop']],
  ['Wait For U', 'Future, Drake, Tems', 84, '12A', ['hip hop', 'r&b']], ['Sunflower', 'Post Malone, Swae Lee', 90, '5A', ['hip hop', 'pop']],
];

const LIBRARY: Track[] = L.map(([title, artists, bpm, key, genres], i) => ({
  id: `c${i}`, title, artists, bpm, key, genres, dur: 150 + ((i * 37) % 120), hue: (i * 53 + 20) % 360,
}));

const copy = (t: Track): Track => ({ ...t, genres: [...t.genres] });

export const mockProvider: TrackProvider = {
  async search(query) {
    const q = query.trim().toLowerCase();
    return LIBRARY.filter((t) => !q || `${t.title} ${t.artists}`.toLowerCase().includes(q)).map(copy);
  },
  async candidates() {
    return LIBRARY.map(copy);
  },
  cachedCandidates() {
    return null;
  },
  async spotifyDetails() {
    return {};
  },
  async features(tracks) {
    const byId = new Map(LIBRARY.map((t) => [t.id, t]));
    const out: Record<string, { bpm: number | null; key: CamelotKey | null }> = {};
    for (const t of tracks) {
      const known = byId.get(t.id);
      if (known) out[t.id] = { bpm: known.bpm, key: known.key };
    }
    return out;
  },
};
