import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import { Badge, Card, EmptyState, Input, Loading } from "../components/ui"
import type { BuilderSummary, Conversation, Page } from "../lib/types"

// Explore Builders (blueprint §5) — public, searches name OR skill
// (debounced), paginated like Browse Projects. Each row links to the public
// profile and can start a conversation via the same find-or-create flow used
// on the profile page's Message button.
export default function ExploreBuildersPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Page<BuilderSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagingId, setMessagingId] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)

  // Debounce the search text, and reset to page 1 when it changes.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

  // A request sequence guard so a stale (older) response never overwrites a
  // newer one when the query/page changes quickly.
  const seqRef = useRef(0)
  const fetchList = useCallback(async () => {
    const seq = ++seqRef.current
    setLoading(true)
    setMessageError(null)
    const params = new URLSearchParams({ page: String(page), per_page: "12" })
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim())
    try {
      const res = await api<Page<BuilderSummary>>(`/users?${params}`)
      if (seq === seqRef.current) setResult(res)
    } catch {
      if (seq === seqRef.current) setResult(null)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [debouncedQuery, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  async function startChat(builder: BuilderSummary) {
    if (!user) return
    setMessagingId(builder.id)
    setMessageError(null)
    try {
      const d = await api<{ conversation: Conversation }>("/conversations", {
        method: "POST",
        body: { user_id: builder.id },
      })
      navigate(`/chat?c=${d.conversation.id}`)
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Failed to start a conversation")
    } finally {
      setMessagingId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.per_page)) : 1
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Explore Builders</h1>
        <p className="text-sm text-muted-foreground">Find collaborators by name or skill.</p>
      </div>

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search builders by skill or name..."
        className="h-11 text-base font-semibold"
        aria-label="Search builders by skill or name"
      />

      {messageError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {messageError}
        </p>
      ) : null}

      {loading ? (
        <Loading />
      ) : !result || result.data.length === 0 ? (
        <EmptyState
          title={debouncedQuery.trim() ? "No builders match your search" : "No builders yet"}
          hint={debouncedQuery.trim() ? "Try a different name or skill." : undefined}
        />
      ) : (
        <div className="space-y-3">
          {result.data.map((b) => (
            <Card key={b.id}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-base font-semibold text-muted-foreground">
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt={b.name} className="h-full w-full object-cover" />
                  ) : (
                    b.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  {b.headline ? <p className="truncate text-sm text-muted-foreground">{b.headline}</p> : null}
                  {b.skills.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {b.skills.map((s) => (
                        <Badge key={s.id}>{s.name}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to={`/builders/${b.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    View Profile
                  </Link>
                  {b.id !== user?.id ? (
                    user ? (
                      <button
                        type="button"
                        onClick={() => startChat(b)}
                        disabled={messagingId === b.id}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {messagingId === b.id ? "Starting…" : "Message"}
                      </button>
                    ) : (
                      <Link
                        to="/sign-in"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Message
                      </Link>
                    )
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {result && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border bg-background px-3 py-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page {result.page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border bg-background px-3 py-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}