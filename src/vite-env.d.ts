/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}