import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseCSV, parseDuration, titleFromFileName, tracksFromCSV } from '../csv';

const EXPORTIFY_HEADER =
  'Track URI,Track Name,Artist Name(s),Album Name,Duration (ms),Genres,Danceability,Key,Mode,Tempo,Album Image URL';

describe('parseCSV', () => {
  it('handles quoted commas, "" escapes, newlines in quotes and CRLF', () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n';
    expect(parseCSV(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
    ]);
  });
  it('strips a leading BOM', () => {
    expect(parseCSV('﻿Track Name\nSong')[0]).toEqual(['Track Name']);
  });
  it('skips blank rows', () => {
    expect(parseCSV('a\n\n,\nb\n')).toEqual([['a'], ['b']]);
  });
});

describe('parseDuration', () => {
  it('accepts m:ss, ms and seconds', () => {
    expect(parseDuration('3:05')).toBe(185);
    expect(parseDuration('173000')).toBe(173);
    expect(parseDuration('210')).toBe(210);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('-5')).toBeNull();
  });
});

describe('tracksFromCSV', () => {
  it('reads an Exportify file in order with Camelot keys', () => {
    const csv = [
      '﻿' + EXPORTIFY_HEADER,
      'spotify:track:1,Nights,Frank Ocean,Blonde,307151,"r&b,Alternative R&B",0.4,7,0,90.3,https://i.scdn.co/a.jpg',
      'spotify:track:2,"Hold On, We\'re Going Home","Drake,Majid Jordan",NWTS,227880,"Hip Hop",0.7,-1,1,100,',
      'spotify:track:3,Pink + White,Frank Ocean,Blonde,184516,,0.5,9,1,160,',
    ].join('\r\n');
    const tracks = tracksFromCSV(csv);
    expect(tracks.map((t) => t.title)).toEqual(['Nights', 'Hold On, We\'re Going Home', 'Pink + White']);
    expect(tracks[0]).toEqual({
      id: 'spotify:track:1',
      title: 'Nights',
      artists: 'Frank Ocean',
      bpm: 90,
      key: '6A',
      dur: 307,
      genres: ['r&b', 'alternative r&b'],
      img: 'https://i.scdn.co/a.jpg',
      hue: expect.any(Number),
    });
    // Exportify bare-comma artists; Key −1 → null
    expect(tracks[1]).toMatchObject({ artists: 'Drake, Majid Jordan', key: null, img: null, genres: ['hip hop'] });
    expect(tracks[2]).toMatchObject({ key: '11B', genres: [] });
  });

  it('accepts a Camelot column and m:ss durations, and generates ids', () => {
    const tracks = tracksFromCSV('title,artist,camelot,bpm,duration\nA,X,8a,99.6,3:30\nB,,,0,\n');
    expect(tracks[0]).toMatchObject({ key: '8A', bpm: 100, dur: 210 });
    expect(tracks[0].id).toBeTruthy();
    expect(tracks[1]).toMatchObject({ artists: 'Unknown artist', key: null, bpm: null, dur: null });
    expect(tracks[0].id).not.toBe(tracks[1].id);
  });

  it('skips rows without a title and keeps ids unique', () => {
    const tracks = tracksFromCSV('Track Name,Track URI\nA,u1\n,u2\nA again,u1\n');
    expect(tracks.map((t) => t.id)).toEqual(['u1', 'u1~2']);
  });

  it('reads the template', () => {
    expect(tracksFromCSV(CSV_TEMPLATE)[0]).toMatchObject({
      title: 'Parking Lot', artists: 'Mustard, Travis Scott', bpm: 100, key: '6A', dur: 173, genres: ['hip hop', 'trap'],
    });
  });

  it('errors on missing rows, missing title column and all-untitled rows', () => {
    expect(() => tracksFromCSV('Track Name\n')).toThrow('This file has no track rows.');
    expect(() => tracksFromCSV('Artist,Tempo\nX,100')).toThrow(
      'Couldn’t find a “Track Name” column. Check that the first row is a header.',
    );
    expect(() => tracksFromCSV('Name,Artist\n,X\n ,Y')).toThrow('No tracks found — every row is missing a track name.');
  });
});

describe('titleFromFileName', () => {
  it('turns the file name into a title', () => {
    expect(titleFromFileName('late_night-100.csv')).toBe('late night 100');
    expect(titleFromFileName('.csv')).toBe('Imported mix');
  });
});
