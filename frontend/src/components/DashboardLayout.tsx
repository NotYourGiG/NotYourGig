import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom"
import { Loading } from "./ui"
import { useCurrentUser } from "../lib/user-context"

// Dashboard tabs per blueprint §5. Home is the 3-card category picker (only
// visible once GitHub is connected); Teams/Connections are stubbed until
// their sessions; Organization Settings appears once orgs exist.
//
// Mandatory GitHub gate: until the user connects GitHub, the profile editor
// (which hosts the Connect button) is the ONLY dashboard page reachable —
// every other dashboard route redirects here so new users can't skip past
// proof-of-work verification.
const tabs = [
  { to: "/dashboard", label: "Home" },
  { to: "/dashboard/profile", label: "My Profile" },
  { to: "/dashboard/projects", label: "My Projects" },
  { to: "/dashboard/applications", label: "My Applications" },
  { to: "/dashboard/teams", label: "My Teams" },
  { to: "/dashboard/connections", label: "Connections" },
]

export default function DashboardLayout() {
  const { user, loading } = useCurrentUser()
  const location = useLocation()

  // Re-sync has not happened yet; show a spinner instead of flickering a
  // redirect before we know whether GitHub is connected.
  if (loading) {
    return (
      <div className="min-h-[50vh]">
        <Loading />
      </div>
    )
  }

  // Enforce GitHub connect: every dashboard route except the profile editor
  // is locked until github_connected_at is set. This covers Home, My
  // Projects, My Applications, My Teams, and Connections.
  const isProfile = location.pathname === "/dashboard/profile"
  if (user && !user.github_connected_at && !isProfile) {
    return <Navigate to="/dashboard/profile" replace />
  }

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/dashboard"}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}