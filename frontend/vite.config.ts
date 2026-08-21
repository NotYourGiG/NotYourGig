import path from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// Client-rendered only (no Next.js / SSR) per blueprint.md Section 10.
export default defineConfig({
  plugins: [react(), tailwindcss()], // Tailwind v4, CSS-first config (see src/index.css)
  envDir: "..", // read .env from the repo root (shared with the backend)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // shadcn/ui default alias
    },
  },
  server: {
    proxy: {
      // Browser talks to same-origin /api; Vite forwards to the NestJS backend.
      "/api": "http://localhost:3000",
    },
  },
})