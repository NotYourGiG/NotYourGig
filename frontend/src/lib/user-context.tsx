import {
  createContext,
  useContext,
  useEffect,
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

  useEffect(() => {
    setTokenProvider(getToken)
    return () => setTokenProvider(null)
  }, [getToken])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isLoaded || !isSignedIn) {
        setUser(null)
        return
      }
      setLoading(true)
      try {
        const data = await api<{ user: User }>("/auth/me")
        if (!cancelled) setUser(data.user)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, getToken, refreshKey])

  return (
    <UserContext.Provider
      value={{ user, loading, refresh: () => setRefreshKey((k) => k + 1) }}
    >
      {children}
    </UserContext.Provider>
  )
}

export const useCurrentUser = () => useContext(UserContext)
