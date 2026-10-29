const BASE62_ID = /^[A-Za-z0-9]{22}$/;

/**
 * The bare Spotify track id from a Track id, URI or open.spotify.com URL; null for anything else
 * (manual tracks, mock ids).
 */
export function spotifyIdOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const m =
    v.match(/^spotify:track:([A-Za-z0-9]{22})$/) ?? v.match(/open\.spotify\.com\/(?:[\w-]+\/)?track\/([A-Za-z0-9]{22})/);
  if (m) return m[1];
  return BASE62_ID.test(v) ? v : null;
}

/** Track ids for catalogue tracks use the Spotify URI, so they match Exportify CSV ids. */
export const trackIdFor = (spotifyId: string) => `spotify:track:${spotifyId}`;
