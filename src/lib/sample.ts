import type { PlanState, Track } from './types';

const SAMPLE_TRACKS: Track[] = [
  { id: 'p1', dur: 173, title: 'Parking Lot', artists: 'Mustard, Travis Scott', bpm: 100, key: '6A', genres: ['hip hop', 'trap'], img: null, hue: 30 },
  { id: 'p2', dur: 228, title: "Hold On, We're Going Home", artists: 'Drake, Majid Jordan', bpm: 100, key: '10A', genres: ['hip hop', 'r&b'], img: null, hue: 200 },
  { id: 'p3', dur: 256, title: '9', artists: 'Drake', bpm: 100, key: '7A', genres: ['hip hop', 'r&b'], img: null, hue: 215 },
  { id: 'p4', dur: 217, title: 'hey now', artists: 'Kendrick Lamar, Dody6', bpm: 102, key: '8A', genres: ['hip hop'], img: null, hue: 350 },
  { id: 'p5', dur: 156, title: 'peekaboo', artists: 'Kendrick Lamar, AZ Chike', bpm: 100, key: '12A', genres: ['hip hop', 'afrobeats'], img: null, hue: 10 },
];

/** Fixed id, so reopening the sample overwrites (resets) it. */
export function samplePlan(): PlanState {
  return {
    id: 'sample',
    title: 'Late Night 100',
    tracks: SAMPLE_TRACKS.map((t) => ({ ...t, genres: [...t.genres] })),
    notes: {
      'p1|p2': { rating: 3, text: 'Long blend; drop the bass on the next phrase. Key jump is a bit sharp.' },
      'p2|p3': { rating: 5, text: '' },
      'p3|p4': { rating: 4, text: '' },
    },
  };
}
