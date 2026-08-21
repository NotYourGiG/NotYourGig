import { Link, Outlet } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../lib/theme-context"

// Shared chrome for the whole app. The brand renders the correct logo file
// for the active theme and the navbar's top-right host the light/dark toggle.
// Logo sizing: at sm+ the transparent 866x288 logos render at h-[76px], so the
// wordmark glyph (~42-44% of the canvas) reads at ~32px — matching the ~32px
// Sign in button. On small phones a smaller h-8 is used so the 866:288 aspect
// is preserved (w-auto + max-w-none) and the header never overflows.
export default function AppLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"
  const nextTheme = isDark ? "light" : "dark"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between px-4 lg:px-3">
          <Link to="/" className="inline-flex items-center" aria-label="Not Your Gig home">
            <img
              src={
                isDark
                  ? "/assets/FinalLogoForDarkTheme.png"
                  : "/assets/FinalLogo.png"
              }
              alt="Not Your Gig"
              className="h-8 w-auto shrink-0 max-w-none sm:h-[76px]"
            />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/projects" className="transition-colors hover:text-foreground">
              Browse Projects
            </Link>
            <Link to="/builders" className="transition-colors hover:text-foreground">
              Explore Builders
            </Link>
            {isLoaded && isSignedIn ? (
              <>
                <Link to="/projects/new" className="transition-colors hover:text-foreground">
                  Post a Project
                </Link>
                <Link to="/dashboard/profile" className="transition-colors hover:text-foreground">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {isDark ? (
                // Dark theme is active -> offer switching to light, so show a sun.
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                // Light theme is active -> offer switching to dark, so show a moon.
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t bg-background py-6 text-center text-xs text-muted-foreground">
        Proof &gt; Resume — Not Your Gig
      </footer>
    </div>
  )
}