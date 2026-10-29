# Mix Planner

Plan DJ mixes: order tracks, rate and annotate each transition, and get suggestions ranked by
Camelot key, BPM and genre. React 19 + Vite; plans autosave to `localStorage` and export as `.mixplan.json`.
Hosted on Vercel, with a few serverless functions that hold the API keys.

- Design source of truth: `design/mix-planner.html` (prototype) and `docs/MIX_PLANNER_HANDOVER.md`, kept locally (gitignored)
- Domain logic (unit-tested): `src/lib/`. State, storage and autosave: `src/state/`. API functions: `server/` and `api/`
- The app gets track data through `TrackProvider` (`src/lib/provider.ts`): our `/api` by default, or the built-in mock library

```bash
npm run dev        # dev server; also serves /api using keys from .env.local
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run lint
```

## Track data

| Need | Source |
|---|---|
| Finding songs (Add song search) | Spotify Web API search, with a FreqBlog name lookup as the fallback |
| BPM and key (Camelot) | FreqBlog `/lookup`, by track + artist name |
| Recommendation ideas | Gemini suggests 10 songs, each is verified on FreqBlog, then the app ranks them by key/BPM/genre |

The browser only talks to `/api/search`, `/api/features` and `/api/recommend`. Those run in `server/routes.ts`,
as Vercel Edge functions (`api/*.ts`) in production and inside the Vite dev server locally, so keys never
reach the browser.

**Spotify data never goes into Gemini.** Spotify's Developer Policy (III.14) forbids ingesting Spotify content
into an AI model. Gemini prompts are built only from FreqBlog records (`buildRecommendationPrompt(FreqSong[])`,
covered by a test), and Spotify is only queried afterwards, for album art.

### FreqBlog quota

The free tier is **1,000 lookups a month**, with at most 6 in flight. Paid plans start at £9.99/month. To stay
inside it:

- Search results come from Spotify alone, so they show "–" for BPM and key. A song is looked up once, when it's
  added (`SEARCH_ENRICH` in `server/routes.ts` changes this).
- A recommendation costs up to 12 lookups: the seeds plus 10 suggestions. Each seed's result is cached.
- Lookups (hits and misses) are cached in the browser for 7 days and in the server instance for 24 hours.
  Tracks FreqBlog has queued (HTTP 202) are re-asked after 10 minutes.

Every FreqBlog response carries `X-Quota-Used` / `X-Quota-Limit` headers if you want to watch usage.

### Setup

1. Put the keys in `.env.local` (gitignored). In Vercel, add the same variables under
   Project → Settings → Environment Variables. Don't prefix them with `VITE_`, which would bundle them into the app.

   ```bash
   SPOTIFY_CLIENT_ID=
   SPOTIFY_CLIENT_SECRET=
   FREQBLOG_API_KEY=
   GEMINI_API_KEY=
   # optional
   # FREQBLOG_BASE_URL=https://api.freqblog.com
   # GEMINI_MODEL=gemini-3.5-flash
   ```

2. **Spotify:** create an app at developer.spotify.com. Since Feb 2026, development-mode apps need the owner to have
   Spotify Premium, and search returns at most 10 results.
3. **FreqBlog:** sign up at freqblog.com. The free tier needs no card.
4. **Gemini:** create a key in Google AI Studio. `GEMINI_MODEL` defaults to `gemini-3.5-flash`.

Offline, without keys: `VITE_TRACK_PROVIDER=mock npm run dev`.

### Verified live (2026-10-29)

- Spotify app-only search works. If Spotify ever answers 401/403, search falls back to FreqBlog.
- FreqBlog `/lookup` returns BPM, key and genres, and the parser handles its response.
- Gemini `generateContent` with structured JSON works on `gemini-3.5-flash`; a recommendation takes about 7s end to end.
  Don't use the `gemini-flash-latest` alias: for new keys, it hangs without answering.

Still unverified: the Vercel Edge runtime for `api/*.ts`, so check the first deploy.

### Before going public

Spotify's Design Guidelines require a Spotify logo and a link back to the track on Spotify wherever Spotify
metadata or artwork is shown. That needs a design decision and isn't in the UI yet.

## Credits

BPM and key data from [FreqBlog](https://freqblog.com).
