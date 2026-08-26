import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { Loading } from "./ui"
import { useCurrentUser } from "../lib/user-context"

// Mandatory-GitHub gate for authenticated routes OUTSIDE the dashboard
// layout (e.g. /projects/new). Redirects to the profile editor (which hosts
// the Connect GitHub button) until github_connected_at is set. Dashboard
// routes are gated inside DashboardLayout itself.
export default function RequireGithub({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser()

  if (loading) {
    return (
      <div className="min-h-[50vh]">
        <Loading />
      </div>
    )
  }
  if (user && !user.github_connected_at) {
    return <Navigate to="/dashboard/profile" replace />
  }
  return <>{children}</>
}