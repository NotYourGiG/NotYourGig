import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../lib/api"
import { useCurrentUser } from "../../lib/user-context"
import { Badge, EmptyState, Loading } from "../../components/ui"
import type { Page, Project } from "../../lib/types"

const TYPE_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  equity: "Equity",
  learning: "Learning",
}

// Dashboard -> My Projects: projects I posted (flow 4.2 dashboard tab).
export default function MyProjectsPage() {
  const { user } = useCurrentUser()
  const [result, setResult] = useState<Page<Project> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    api<Page<Project>>(`/projects?user_id=${user.id}&per_page=50`)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <Loading />

  const projects = result?.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Projects</h1>
        <p className="text-sm text-muted-foreground">Projects you've posted.</p>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          title="You haven't posted any projects yet"
          hint={<Link to="/projects/new" className="underline">Post your first project</Link>}
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-ring"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.title}</span>
                <Badge>{TYPE_LABELS[p.type] ?? p.type}</Badge>
                <Badge>{p.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{p.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}