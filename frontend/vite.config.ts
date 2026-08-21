import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// Client-rendered only (no Next.js / SSR) per blueprint.md Section 10.
// The frontend is a self-contained Vercel project: it reads its own
// frontend/.env (or Vercel-project env vars) for VITE_* keys. The backend is
// deployed separately, and the deployed API base is provided via
// VITE_API_URL (see src/lib/api.ts). In local dev the /api proxy forwards to
// the NestJS backend on localhost:3000.
export default defineConfig({
  plugins: [react(), tailwindcss()], // Tailwind v4, CSS-first config (see src/index.css)
  envDir: ".", // read .env from the frontend folder (self-contained on Vercel)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // shadcn/ui default alias
    },
  },
  server: {
    proxy: {
      // Local dev only: browser talks to same-origin /api; Vite forwards to
      // the NestJS backend. Production uses VITE_API_URL instead.
      "/api": "http://localhost:3000",
    },
  },
})