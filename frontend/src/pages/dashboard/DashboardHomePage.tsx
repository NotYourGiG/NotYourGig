import { Link, Navigate } from "react-router-dom"
import { Card, Loading } from "../../components/ui"
import { useCurrentUser } from "../../lib/user-context"

const rows = [
  {
    to: "/projects?type=paid",
    title: "Find Internship",
    description: "Browse open opportunities",
  },
  {
    to: "/projects?poster=org",
    title: "Find Talent",
    description: "Search builders by proof",
  },
  {
    to: "/builders",
    title: "Find a Builder",
    description: "Connect with collaborators",
  },
]

// Dashboard home — three stacked entry rows. Each row: a flat chevron icon on
// the left, bold title, one-line description. Vertical stack (not side-by-side
// cards) so the page fills the space better while staying flat/minimal per the
// brand guidelines. Only reachable once GitHub is connected (the mandatory
// gate lives in DashboardLayout; the check here is a backstop).
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
            {/* Flat chevron mark — minimal, no gradients; matches the
                chevron-icon branding direction. */}
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
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