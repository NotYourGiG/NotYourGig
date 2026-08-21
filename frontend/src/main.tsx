import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ClerkProvider } from "@clerk/clerk-react"
import App from "./App"
import { UserProvider } from "./lib/user-context"
import { ThemeProvider } from "./lib/theme-context"
import { clerkPublishableKey, clerkReady } from "./lib/clerk-config"
import "./index.css"

// Client-rendered only (no SSR) per blueprint.md Section 10.
const root = document.getElementById("root")!

if (!clerkReady) {
  // Don't render a half-broken app: auth screens need the publishable key.
  createRoot(root).render(
    <StrictMode>
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-xl font-semibold">Not Your Gig</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Clerk keys are not configured yet. Add{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">VITE_CLERK_PUBLISHABLE_KEY</code>{" "}
          to <code className="rounded bg-muted px-1.5 py-0.5">.env</code> at the repo root and
          restart the dev server.
        </p>
      </div>
    </StrictMode>,
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInFallbackRedirectUrl="/dashboard/profile"
        signUpFallbackRedirectUrl="/dashboard/profile"
      >
        <ThemeProvider>
          <BrowserRouter>
            <UserProvider>
              <App />
            </UserProvider>
          </BrowserRouter>
        </ThemeProvider>
      </ClerkProvider>
    </StrictMode>,
  )
}