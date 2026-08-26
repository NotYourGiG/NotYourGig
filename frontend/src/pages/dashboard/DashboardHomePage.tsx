import { Link, Navigate } from "react-router-dom"
import { Card, Loading } from "../../components/ui"
import { useCurrentUser } from "../../lib/user-context"

// Flat, minimal inline icons — stroke-based, no gradients, same 22px/2px
// stroke weight as the original chevron so the row layout doesn't shift.

/** Terminal prompt: ">" chevron + short vertical cursor line. */
function TerminalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 8.5 4 3.5-4 3.5" />
      <path d="M16.5 9.5v5" />
    </svg>
  )
}

/** Magnifying glass / search. */
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5" />
    </svg>
  )
}

/** Two crossed diagonal arrows pointing away from each other (an "X"). */
function CrossArrowsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* arrow pointing up-right */}
      <path d="M8 16 16 8" />
      <path d="M16 8h-3.5M16 8v3.5" />
      {/* arrow pointing down-left */}
      <path d="M16 8 8 16" />
      <path d="M8 16h3.5M8 16v-3.5" />
    </svg>
  )
}

const rows = [
  {
    to: "/projects?type=paid",
    title: "Find Internship",
    description: "Browse open opportunities",
    icon: <TerminalIcon />,
    badgeClass:
      "flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-foreground text-background",
  },
  {
    to: "/projects?poster=org",
    title: "Find Talent",
    description: "Search builders by proof",
    icon: <SearchIcon />,
    badgeClass:
      "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground",
  },
  {
    to: "/builders",
    title: "Find a Builder",
    description: "Connect with collaborators",
    icon: <CrossArrowsIcon />,
    badgeClass:
      "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground",
  },
]

// Dashboard home — three stacked entry rows. Each row: an icon badge on the
// left, bold title, one-line description. Vertical stack so the page fills
// the space better while staying flat/minimal per the brand guidelines. Only
// reachable once GitHub is connected (the mandatory gate lives in
// DashboardLayout; the check here is a backstop).
export default function DashboardHomePage() {
  const { user, loading } = useCurrentUser()

  if (loading) return <Loading />
  if (user && !user.github_connected_at) {
    return <Navigate to="/dashboard/profile" replace />
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Link key={r.to} to={r.to} className="group block">
          <Card className="flex items-center gap-4 px-6 py-6 transition-colors group-hover:border-ring">
            <span aria-hidden="true" className={r.badgeClass}>
              {r.icon}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{r.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}