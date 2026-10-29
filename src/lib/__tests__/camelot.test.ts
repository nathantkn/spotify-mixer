import { describe, expect, it } from 'vitest';
import { ALL_KEYS, keyHue, parseCamelot, toCamelot } from '../camelot';

describe('toCamelot', () => {
  it('maps Spotify pitch class + mode', () => {
    expect(toCamelot(0, 1)).toBe('8B'); // C major
    expect(toCamelot(9, 0)).toBe('8A'); // A minor
    expect(toCamelot('7', '0')).toBe('6A'); // G minor
    expect(toCamelot('11', '1')).toBe('1B'); // B major
    expect(toCamelot(1, 0)).toBe('12A');
  });

  it('returns null for -1, blank and out-of-range keys', () => {
    expect(toCamelot(-1, 1)).toBeNull();
    expect(toCamelot('-1', '0')).toBeNull();
    expect(toCamelot('', '1')).toBeNull();
    expect(toCamelot(null)).toBeNull();
    expect(toCamelot(12, 0)).toBeNull();
    expect(toCamelot('5.5', 0)).toBeNull();
    expect(toCamelot('abc', 0)).toBeNull();
  });

  it('uses a value that is already Camelot, uppercased', () => {
    expect(toCamelot('8a')).toBe('8A');
    expect(toCamelot(' 12B ')).toBe('12B');
    expect(parseCamelot('13A')).toBeNull();
    expect(parseCamelot('0B')).toBeNull();
  });
});

describe('keys', () => {
  it('lists all 24 keys, A then B', () => {
    expect(ALL_KEYS).toHaveLength(24);
    expect(ALL_KEYS[0]).toBe('1A');
    expect(ALL_KEYS[12]).toBe('1B');
  });
  it('computes the tag hue', () => {
    expect(keyHue('1A')).toBe(0);
    expect(keyHue('6B')).toBe(150);
    expect(keyHue('12A')).toBe(330);
  });
});
