/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" uses the built-in 18-track library and no APIs. */
  readonly VITE_TRACK_PROVIDER?: 'api' | 'mock';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
