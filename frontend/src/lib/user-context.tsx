import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@clerk/clerk-react"
import { api, setTokenProvider } from "./api"
import type { User } from "./types"

interface UserContextValue {
  user: User | null
  loading: boolean
  refresh: () => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: false,
  refresh: () => {},
})

// On Clerk sign-in, syncs with the backend (GET /api/auth/me), which
// get-or-creates the users row on first login (blueprint flow 4.1).
// Also registers the Clerk token provider so api() attaches the session
// token to every request automatically.
export function UserProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Stable reference so consumers can safely put `refresh` in a useEffect
  // dependency array without re-firing on every render. (An inline arrow
  // here would be a new reference each render, and any consumer effect that
  // depends on it would loop forever — see the GitHub redirect handler on
  // ProfilePage that calls refresh() inside an effect.)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Anti-spiral guard for the /auth/me sync effect below: if it fails N times
  // in a row (e.g. a misconfigured API base, a flaky network, or another
  // unstable dependency), back off with a delay instead of hammering the
  // endpoint — it can never degrade into thousands of requests per second.
  const consecutiveFailuresRef = useRef(0)
  const MAX_CONSECUTIVE_FAILURES = 5
  const RETRY_DELAY_MS = 2_000

  useEffect(() => {
    setTokenProvider(getToken)
    return () => setTokenProvider(null)
  }, [getToken])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      if (!isLoaded || !isSignedIn) {
        setUser(null)
        return
      }
      // Backoff: after MAX_CONSECUTIVE_FAILURES failures in a row, wait
      // RETRY_DELAY_MS before attempting again so a broken upstream can't
      // cause an unbounded request storm.
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        retryTimer = setTimeout(() => {
          consecutiveFailuresRef.current = 0
          load()
        }, RETRY_DELAY_MS)
        return
      }
      setLoading(true)
      try {
        const data = await api<{ user: User }>("/auth/me")
        consecutiveFailuresRef.current = 0
        if (!cancelled) setUser(data.user)
      } catch {
        consecutiveFailuresRef.current += 1
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [isLoaded, isSignedIn, getToken, refreshKey])

  return (
    <UserContext.Provider
      value={{ user, loading, refresh }}
    >
      {children}
    </UserContext.Provider>
  )
}

export const useCurrentUser = () => useContext(UserContext)
