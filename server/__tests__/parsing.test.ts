import { describe, expect, it } from 'vitest';
import { fromKeyName, fromOpenKey } from '../../src/lib/camelot';
import { baseTitle, cleanTitle, sameSong } from '../../src/lib/match';
import { buildRecommendationPrompt, parseSuggestions } from '../gemini';
import { parseSearch, parseSong } from '../getsongbpm';

describe('key notation', () => {
  it.each([
    ['1d', '8B'], ['1m', '8A'], ['2m', '9A'], ['6m', '1A'], ['7m', '2A'], ['12d', '7B'],
  ])('Open Key %s → %s', (ok, cam) => expect(fromOpenKey(ok)).toBe(cam));
  it.each([
    ['Em', '9A'], ['C', '8B'], ['F♯m', '11A'], ['F#m', '11A'], ['Bbm', '3A'], ['Db major', '3B'], ['A minor', '8A'], ['Ab', '4B'],
  ])('%s → %s', (name, cam) => expect(fromKeyName(name)).toBe(cam));
  it('rejects junk', () => {
    expect(fromOpenKey('13m')).toBeNull();
    expect(fromKeyName('H')).toBeNull();
    expect(fromKeyName(null)).toBeNull();
  });
});

describe('song matching', () => {
  it('cleans titles', () => {
    expect(baseTitle('Hold On, We’re Going Home - Remastered 2011')).toBe('Hold On, We’re Going Home');
    expect(cleanTitle('Passionfruit (feat. Someone)')).toBe('passionfruit');
    expect(cleanTitle('Wait For U ft. Drake')).toBe('wait for u');
    expect(cleanTitle('Beyoncé')).toBe('beyonce');
  });
  it('matches across catalogues', () => {
    expect(sameSong({ title: 'Nights', artists: 'Frank Ocean' }, { title: 'NIGHTS', artists: 'Frank Ocean' })).toBe(true);
    expect(sameSong({ title: 'Peaches & Eggplants', artists: 'Young Nudy, 21 Savage' }, { title: 'Peaches and Eggplants', artists: '21 Savage' })).toBe(true);
    expect(sameSong({ title: 'Nights', artists: 'Frank Ocean' }, { title: 'Nights', artists: 'Avenged Sevenfold' })).toBe(false);
    expect(sameSong({ title: 'Nights', artists: 'Frank Ocean' }, { title: 'Nikes', artists: 'Frank Ocean' })).toBe(false);
  });
});

describe('GetSongBPM parsing', () => {
  const raw = {
    id: 'o2r0L', title: 'Master of Puppets', tempo: '220', time_sig: '4/4', key_of: 'Em', open_key: '2m',
    artist: { id: 'nZR', name: 'Metallica', genres: ['Heavy Metal', 'rock'] },
  };
  it('parses a song', () => {
    expect(parseSong(raw)).toEqual({ id: 'o2r0L', title: 'Master of Puppets', artist: 'Metallica', genres: ['heavy metal', 'rock'], bpm: 220, key: '9A' });
  });
  it('falls back to key_of without open_key, and tolerates gaps', () => {
    expect(parseSong({ ...raw, open_key: undefined, key_of: 'C' })?.key).toBe('8B');
    expect(parseSong({ id: 'x', title: 'T', tempo: '' })).toMatchObject({ artist: 'Unknown artist', bpm: null, key: null, genres: [] });
    expect(parseSong({ title: 'no id' })).toBeNull();
  });
  it('reads the search envelope, including the no-result form', () => {
    expect(parseSearch({ search: [raw, { bad: 1 }] })).toHaveLength(1);
    expect(parseSearch({ search: { error: 'no result' } })).toEqual([]);
    expect(parseSearch(null)).toEqual([]);
  });
});

describe('Gemini', () => {
  const seed = { id: 'g1', title: 'Nights', artist: 'Frank Ocean', genres: ['r&b'], bpm: 90, key: '6A' as const };
  it('builds a prompt from GetSongBPM facts', () => {
    const p = buildRecommendationPrompt([seed]);
    expect(p).toContain('"Nights" by Frank Ocean — 90 BPM, key 6A (Camelot), genres: r&b');
    expect(p).toContain('right after this song');
    expect(buildRecommendationPrompt([seed, { ...seed, id: 'g2', bpm: null, key: null, genres: [] }])).toContain('tempo unknown, key unknown');
  });
  it('parses suggestions defensively', () => {
    expect(parseSuggestions('[{"title":"A","artist":"X"},{"title":"","artist":"Y"},{"title":"B"}]')).toEqual([{ title: 'A', artists: 'X' }]);
    expect(parseSuggestions('```json\n{"songs":[{"title":"A","artist":"X"}]}\n```')).toEqual([{ title: 'A', artists: 'X' }]);
    expect(parseSuggestions('not json')).toEqual([]);
    expect(parseSuggestions(JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ title: `S${i}`, artist: 'X' }))))).toHaveLength(15);
  });
});
