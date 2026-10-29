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
| Finding songs (Add song search) | Spotify Web API search, with GetSongBPM search as the fallback |
| BPM, key and genres | GetSongBPM, looked up by title + artist |
| Recommendation ideas | Gemini suggests songs, each is verified on GetSongBPM, then the app ranks them by key/BPM/genre |

The browser only talks to `/api/search`, `/api/features` and `/api/recommend`. Those run in `server/routes.ts`,
as Vercel Edge functions (`api/*.ts`) in production and inside the Vite dev server locally, so keys never
reach the browser. Upstream results are cached in memory to protect quotas.

**Spotify data never goes into Gemini.** Spotify's Developer Policy (III.14) forbids ingesting Spotify content
into an AI model. Gemini prompts are built only from GetSongBPM records (`buildRecommendationPrompt(GsbSong[])`,
covered by a test), and Spotify is only queried afterwards, for album art.

### Setup

1. Put the keys in `.env.local` (gitignored). In Vercel, add the same variables under
   Project → Settings → Environment Variables. Don't prefix them with `VITE_`, which would bundle them into the app.

   ```bash
   SPOTIFY_CLIENT_ID=
   SPOTIFY_CLIENT_SECRET=
   GETSONGBPM_API_KEY=
   GEMINI_API_KEY=
   # optional
   # GETSONGBPM_BASE_URL=https://api.getsong.co
   # GEMINI_MODEL=gemini-flash-latest
   ```
2. **Spotify:** create an app at developer.spotify.com. Since Feb 2026, development-mode apps need the owner to have
   Spotify Premium, and search returns at most 10 results.
3. **GetSongBPM:** sign up at getsongbpm.com/api with this repo's [Credits](#credits) section as the backlink.
   It must stay public, or the key gets suspended. The limit is 3,000 requests/hour.
4. **Gemini:** create a key in Google AI Studio. `GEMINI_MODEL` defaults to the `gemini-flash-latest` alias.

Offline, without keys: `VITE_TRACK_PROVIDER=mock npm run dev`.

### Not yet verified against the live APIs

- GetSongBPM: the base URL `api.getsong.co`, the `X-API-KEY` header, the `{search: [...]}` envelope and
  whether `open_key` exists (`key_of` is the fallback).
- Spotify: whether the app-only token still works for search. If Spotify answers 401/403, search falls back to GetSongBPM.
- Gemini: the `responseSchema` structured output on `generateContent`.
- Vercel: the Edge runtime for `api/*.ts`.

### Before going public

Spotify's Design Guidelines require a Spotify logo and a link back to the track on Spotify wherever Spotify
metadata or artwork is shown. That needs a design decision and isn't in the UI yet.

## Credits

Song tempo, key and genre data provided by [GetSongBPM](https://getsongbpm.com).
