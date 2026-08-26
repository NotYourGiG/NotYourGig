import { Link, Navigate } from "react-router-dom"
import { Card, Loading } from "../../components/ui"
import { useCurrentUser } from "../../lib/user-context"

const cards = [
  { to: "/projects?type=paid", label: "Find Internship" },
  { to: "/projects?poster=org", label: "Find Talent" },
  { to: "/builders", label: "Find a Builder" },
]

// Dashboard home (blueprint §5) — three entry cards, same visual style as the
// landing page's entry cards. Only reachable once GitHub is connected: the
// mandatory-GitHub gate lives in DashboardLayout, so this page renders only
// when user.github_connected_at is set (the guard here is a backstop).
export default function DashboardHomePage() {
  const { user, loading } = useCurrentUser()

  if (loading) return <Loading />
  if (user && !user.github_connected_at) {
    return <Navigate to="/dashboard/profile" replace />
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.to} to={c.to} className="group block">
          <Card className="flex h-full items-center justify-between transition-colors group-hover:border-ring">
            <h2 className="text-base font-semibold">{c.label}</h2>
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              →
            </span>
          </Card>
        </Link>
      ))}
    </div>
  )
}