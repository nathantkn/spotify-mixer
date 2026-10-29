import { describe, expect, it } from 'vitest';
import { fmtDuration, hueOf, parseLength, timeAgo } from '../format';
import { avgMix } from '../plan';
import { samplePlan } from '../sample';

describe('format', () => {
  it('formats durations', () => {
    expect(fmtDuration(173)).toBe('2:53');
    expect(fmtDuration(59.6)).toBe('1:00');
    expect(fmtDuration(null)).toBe('–');
  });
  it('parses lengths', () => {
    expect(parseLength('3:30')).toBe(210);
    expect(parseLength('4')).toBe(240);
    expect(parseLength('abc')).toBeNull();
  });
  it('formats relative time', () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(now - 30_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
    expect(timeAgo(now - 8 * 86_400_000, now)).toBe(new Date(now - 8 * 86_400_000).toLocaleDateString());
  });
  it('hashes hues stably', () => {
    expect(hueOf('Nights')).toBe(hueOf('Nights'));
    expect(hueOf('Nights')).toBeGreaterThanOrEqual(0);
    expect(hueOf('Nights')).toBeLessThan(360);
  });
});

describe('avgMix', () => {
  it('averages rated transitions in the current order only', () => {
    const plan = samplePlan();
    expect(avgMix(plan)).toBe(4);
    // p2,p1,p3,p4,p5: only p3|p4 (4) is still a neighbouring pair
    const swapped = { ...plan, tracks: [plan.tracks[1], plan.tracks[0], ...plan.tracks.slice(2)] };
    expect(avgMix(swapped)).toBe(4);
    expect(avgMix({ ...plan, tracks: [...plan.tracks].reverse() })).toBeNull();
  });
});
