import type { ReactNode } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Navigate, useLocation } from "react-router-dom"

// Protects /dashboard/* and /projects/new — redirects to sign-in if the
// Clerk session is missing, preserving the destination for after-login.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (!isSignedIn) {
    return (
      <Navigate
        to="/sign-in"
        state={{ from: location.pathname }}
        replace
      />
    )
  }
  return <>{children}</>
}
