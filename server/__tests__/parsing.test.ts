import { describe, expect, it } from 'vitest';
import { fromKeyName, fromOpenKey } from '../../src/lib/camelot';
import { baseTitle, cleanTitle, sameSong } from '../../src/lib/match';
import { buildRecommendationPrompt, parseSuggestions } from '../gemini';
import { parseLookup } from '../freqblog';

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

describe('FreqBlog parsing', () => {
  it('reads a flat lookup body, preferring the Camelot field', () => {
    const body = { id: 'fb1', title: 'Blinding Lights', artist: 'The Weeknd', bpm: 171.04, key: 'C#-Minor', camelot: '12A', open_key: '5m', energy: 0.8 };
    expect(parseLookup(body)).toEqual({ id: 'fb1', title: 'Blinding Lights', artist: 'The Weeknd', genres: [], bpm: 171, key: '12A' });
  });
  it('reads features nested under audio_features, and falls back through key notations', () => {
    expect(parseLookup({ track_name: 'X', artists: [{ name: 'A' }, { name: 'B' }], audio_features: { tempo: 99.6, open_key: '1d' } })).toMatchObject({ title: 'X', artist: 'A, B', bpm: 100, key: '8B' });
    expect(parseLookup({ data: { title: 'Y', artist: 'C', bpm: 120, key: 'C#-Minor', genres: 'House, Deep House' } })).toMatchObject({ key: '12A', genres: ['house', 'deep house'] });
  });
  it('fills names from the request when the body has none, and rejects bodies without data', () => {
    expect(parseLookup({ bpm: 90 }, { title: 'Nights', artists: 'Frank Ocean, X' })).toMatchObject({ title: 'Nights', artist: 'Frank Ocean', id: 'nights|frank ocean' });
    expect(parseLookup({ title: 'No data', artist: 'Z' })).toBeNull();
    expect(parseLookup('nope')).toBeNull();
  });
  it('parses hyphenated and spelled-out key names', () => {
    expect(fromKeyName('C#-Minor')).toBe('12A');
    expect(fromKeyName('Db Major')).toBe('3B');
    expect(fromKeyName('CM')).toBe('8B');
    expect(fromKeyName('Cm')).toBe('5A');
  });
});

describe('Gemini', () => {
  const seed = { id: 'g1', title: 'Nights', artist: 'Frank Ocean', genres: ['r&b'], bpm: 90, key: '6A' as const };
  it('builds a prompt from FreqBlog facts', () => {
    const p = buildRecommendationPrompt([seed]);
    expect(p).toContain('"Nights" by Frank Ocean — 90 BPM, key 6A (Camelot), genres: r&b');
    expect(p).toContain('right after this song');
    expect(buildRecommendationPrompt([seed, { ...seed, id: 'g2', bpm: null, key: null, genres: [] }])).toContain('tempo unknown, key unknown');
  });
  it('parses suggestions defensively', () => {
    expect(parseSuggestions('[{"title":"A","artist":"X"},{"title":"","artist":"Y"},{"title":"B"}]')).toEqual([{ title: 'A', artists: 'X' }]);
    expect(parseSuggestions('```json\n{"songs":[{"title":"A","artist":"X"}]}\n```')).toEqual([{ title: 'A', artists: 'X' }]);
    expect(parseSuggestions('not json')).toEqual([]);
    expect(parseSuggestions(JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ title: `S${i}`, artist: 'X' }))))).toHaveLength(10);
  });
});
