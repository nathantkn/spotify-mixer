# Mix Planner

Plan DJ mixes: order tracks, rate and annotate each transition, and get suggestions ranked by
Camelot key, BPM and genre. Client-side only (React 19 + Vite); plans autosave to `localStorage`
and export as `.mixplan.json`.

- Design source of truth: `design/mix-planner.html` (prototype) and `docs/MIX_PLANNER_HANDOVER.md`, kept locally (gitignored)
- Domain logic (unit-tested): `src/lib/`. State, storage and autosave: `src/state/`
- Track data comes through `TrackProvider` (`src/lib/provider.ts`): [ReccoBeats](https://reccobeats.com/docs/documentation/introduction) by default, or the built-in mock library

```bash
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run lint
```

## Track data (ReccoBeats)

ReccoBeats is free and keyless. It supplies search, seed-based recommendations (`/v1/track/recommendation`)
and audio features (tempo, key, mode → Camelot). Tracks are matched by Spotify ID, so Exportify CSV
imports work directly, and missing BPM/key/length is filled in after import. ReccoBeats has no genre data,
so the genre part of the match score only applies to tracks from your own CSV.

- **Dev/preview:** requests go to `/reccobeats/*`, which Vite proxies to `https://api.reccobeats.com`.
- **Static deploy:** set `VITE_RECCOBEATS_URL` (see `.env.example`), either to the API directly if it allows
  your origin (CORS is unconfirmed) or to a small proxy.
- **Offline:** `VITE_TRACK_PROVIDER=mock npm run dev`.

Not yet confirmed against the live API (the code is in `src/lib/reccobeats/`):

- the track-search path and params (`SEARCH_PATH` / `searchParams` in `provider.ts`)
- the exact response envelopes; the parser accepts bare arrays or `{content: [...]}`
- rate limits; 429s are retried with `Retry-After` or backoff, and batches are capped at 40 IDs

## Credits

Song tempo, key and genre data provided by [GetSongBPM](https://getsongbpm.com).
