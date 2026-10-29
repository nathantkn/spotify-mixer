/**
 * Gemini suggests songs that might mix well; FreqBlog then verifies each one.
 * The prompt is built only from FreqBlog data (FreqSong). Spotify data must never reach it:
 * Spotify's Developer Policy (III.14) forbids ingesting Spotify Content into an AI model.
 */
import type { SongRef } from '../src/lib/apiTypes';
import { ConfigError, fetchWithTimeout, UpstreamError, type Deps } from './core';
import type { FreqSong } from './freqblog';

const BASE = 'https://generativelanguage.googleapis.com';
/**
 * Override with GEMINI_MODEL. Not the `gemini-flash-latest` alias: for new keys, generateContent on it
 * hangs without answering (checked 2026-10-29), while gemini-3.5-flash replies normally.
 */
const DEFAULT_MODEL = 'gemini-3.5-flash';
/** Each suggestion costs one FreqBlog lookup to verify, and the free tier is 1,000 a month. */
export const SUGGESTIONS = 10;
/** Leaves room for the lookups after it inside Vercel's 25s Edge response window. */
const TIMEOUT_MS = 15_000;

const describe = (s: FreqSong) =>
  `"${s.title}" by ${s.artist} — ${s.bpm ? `${s.bpm} BPM` : 'tempo unknown'}, ${
    s.key ? `key ${s.key} (Camelot)` : 'key unknown'
  }${s.genres.length ? `, genres: ${s.genres.join(', ')}` : ''}`;

export function buildRecommendationPrompt(seeds: FreqSong[], count = SUGGESTIONS): string {
  const bridge = seeds.length > 1;
  return [
    `You are helping a DJ plan a mix. Suggest ${count} real, commercially released songs that would mix well ${
      bridge ? 'as a bridge between these two songs, played between them' : 'right after this song'
    }:`,
    ...seeds.map((s, i) => `${i + 1}. ${describe(s)}`),
    '',
    'Rules:',
    `- Tempo within about 6% of ${bridge ? 'both songs' : 'the song'}; half or double time is fine.`,
    '- Harmonically compatible: the same Camelot key, one step around the wheel, or the relative major/minor.',
    '- Similar genre and energy.',
    '- Only songs you are confident exist, with the primary artist as credited. No covers, remixes or the songs above.',
    'Reply with JSON only.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { title: { type: 'STRING' }, artist: { type: 'STRING' } },
    required: ['title', 'artist'],
  },
};

/** Gemini's reply text → song references. Tolerates code fences and a wrapping object. */
export function parseSuggestions(text: string, max = SUGGESTIONS): SongRef[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    return [];
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? (Object.values(data).find(Array.isArray) ?? [])
      : [];
  return (list as unknown[])
    .map((x) => (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.title === 'string' && typeof x.artist === 'string' && x.title.trim() && x.artist.trim())
    .slice(0, max)
    .map((x) => ({ title: String(x.title).trim(), artists: String(x.artist).trim() }));
}

export function createGemini({ env, fetch }: Deps) {
  const configured = Boolean(env.GEMINI_API_KEY);
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  async function suggest(seeds: FreqSong[], count = SUGGESTIONS): Promise<SongRef[]> {
    if (!env.GEMINI_API_KEY) throw new ConfigError('GEMINI_API_KEY is not set');
    const url = `${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetchWithTimeout(fetch, 'Gemini', url, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildRecommendationPrompt(seeds, count) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
          // Listing songs doesn't need deep reasoning, and latency matters inside the 25s window.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    }, TIMEOUT_MS);
    if (!res.ok) {
      // Gemini's error body says why (bad key, unknown model, quota); keep it for the server log.
      const detail = await res.text().catch(() => '');
      throw new UpstreamError('Gemini', res.status, `responded with ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    // Thinking models can return thought parts; only the answer parts hold the JSON.
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    return parseSuggestions(text, count);
  }

  return { configured, model, suggest };
}

export type Gemini = ReturnType<typeof createGemini>;
