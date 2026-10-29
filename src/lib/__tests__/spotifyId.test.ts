import { describe, expect, it } from 'vitest';
import { spotifyIdOf, trackIdFor } from '../spotifyId';

describe('spotifyIdOf', () => {
  const id = '7eqoqGkKwgOaWNNHx90uEZ';
  it('reads URIs, URLs and bare ids', () => {
    expect(spotifyIdOf(`spotify:track:${id}`)).toBe(id);
    expect(spotifyIdOf(`https://open.spotify.com/track/${id}?si=abc`)).toBe(id);
    expect(spotifyIdOf(`https://open.spotify.com/intl-de/track/${id}`)).toBe(id);
    expect(spotifyIdOf(id)).toBe(id);
  });
  it('rejects everything else', () => {
    expect(spotifyIdOf('c3')).toBeNull();
    expect(spotifyIdOf('m_lx2abc')).toBeNull();
    expect(spotifyIdOf('spotify:album:' + id)).toBeNull();
    expect(spotifyIdOf(null)).toBeNull();
  });
  it('round-trips', () => {
    expect(spotifyIdOf(trackIdFor(id))).toBe(id);
  });
});
