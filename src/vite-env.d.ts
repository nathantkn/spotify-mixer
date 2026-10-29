/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" uses the built-in 18-track library instead of ReccoBeats. */
  readonly VITE_TRACK_PROVIDER?: 'reccobeats' | 'mock';
  /** ReccoBeats base URL. Defaults to the /reccobeats dev/preview proxy. */
  readonly VITE_RECCOBEATS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
