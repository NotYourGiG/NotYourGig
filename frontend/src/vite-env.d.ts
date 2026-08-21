/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base URL of the deployed backend (origin + /api). */
  readonly VITE_API_URL?: string
  /** Clerk frontend publishable key (pk_...). */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
