import { useEffect, useRef, useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Menu, Moon, Sun, X } from "lucide-react"
import { cn } from "../lib/utils"
import { useTheme } from "../lib/theme-context"

const linkClass =
  "transition-colors hover:text-foreground"

// Shared chrome for the whole app. The brand renders the correct logo file
// for the active theme and the navbar's top-right host the light/dark toggle.
// On mobile the nav collapses behind a hamburger; the theme toggle stays
// visible in the top bar for convenience.
// Logo sizing: at sm+ the transparent 866x288 logos render at h-[64px] on
// tablet / h-[76px] on desktop, so the wordmark glyph reads at ~28-32px —
// matching the ~32px Sign in button. On small phones h-8 keeps the 866:288
// aspect preserved (w-auto + max-w-none) and the header never overflows.
export default function AppLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const location = useLocation()

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Close when tapping outside the header or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  return (
    <div className="flex min-h-svh flex-col">
      <header
        ref={headerRef}
        className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur"
      >
        <div className="flex h-14 w-full items-center justify-between px-4 lg:px-3">
          <Link to="/" className="inline-flex items-center" aria-label="Not Your Gig home">
            <img
              src={
                isDark
                  ? "/assets/FinalLogoForDarkTheme.png"
                  : "/assets/FinalLogo.png"
              }
              alt="Not Your Gig"
              className="h-8 w-auto shrink-0 max-w-none sm:h-[64px] lg:h-[76px]"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <Link to="/projects" className={linkClass}>
              Browse Projects
            </Link>
            <Link to="/builders" className={linkClass}>
              Explore Builders
            </Link>
            {isLoaded && isSignedIn ? (
              <>
                <Link to="/projects/new" className={linkClass}>
                  Post a Project
                </Link>
                <Link to="/dashboard/profile" className={linkClass}>
                  Dashboard
                </Link>
                <button type="button" onClick={() => signOut()} className={linkClass}>
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
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </nav>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen ? (
          <nav
            id="mobile-nav"
            className="border-t bg-background px-4 py-3 text-sm text-muted-foreground md:hidden"
          >
            <div className="flex flex-col gap-1">
              <Link to="/projects" className={cn(linkClass, "rounded-md px-2 py-2 hover:bg-muted")}>
                Browse Projects
              </Link>
              <Link to="/builders" className={cn(linkClass, "rounded-md px-2 py-2 hover:bg-muted")}>
                Explore Builders
              </Link>
              {isLoaded && isSignedIn ? (
                <>
                  <Link to="/projects/new" className={cn(linkClass, "rounded-md px-2 py-2 hover:bg-muted")}>
                    Post a Project
                  </Link>
                  <Link to="/dashboard/profile" className={cn(linkClass, "rounded-md px-2 py-2 hover:bg-muted")}>
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className={cn(linkClass, "rounded-md px-2 py-2 text-left hover:bg-muted")}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/sign-in"
                  className="mt-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        ) : null}
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