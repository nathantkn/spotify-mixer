/** Loose matching between catalogues (CSV, Spotify, GetSongBPM, Gemini suggestions). */

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** "Song (feat. X) - Remastered 2011" → "Song", keeping case; good for search queries. */
export function baseTitle(title: string): string {
  return (
    title
      .replace(/\s[-–—]\s.*$/, '')
      .replace(/[([](?:feat|ft|with|prod)\b[^)\]]*[)\]]/gi, '')
      .replace(/\s(?:feat|ft)\.?\s.*$/i, '')
      .trim() || title.trim()
  );
}

/** "Song (feat. X) - Remastered 2011" → "song" */
export const cleanTitle = (title: string) => strip(baseTitle(title));

export const cleanArtist = (artist: string) => strip(artist);

/** First credited artist from a ", "-separated display string. */
export const primaryArtist = (artists: string) => artists.split(/\s*,\s*|\s+&\s+|\s+x\s+/i)[0] ?? artists;

/** Same song if the cleaned titles match and one side's artist appears in the other's credits. */
export function sameSong(a: { title: string; artists: string }, b: { title: string; artists: string }): boolean {
  if (cleanTitle(a.title) !== cleanTitle(b.title)) return false;
  const aa = a.artists.split(/\s*,\s*/).map(cleanArtist);
  const bb = b.artists.split(/\s*,\s*/).map(cleanArtist);
  return aa.some((x) => bb.some((y) => x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)))));
}
