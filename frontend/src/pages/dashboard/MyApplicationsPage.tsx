import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../lib/api"
import { Badge, EmptyState, Loading } from "../../components/ui"
import type { Application } from "../../lib/types"

// Dashboard -> My Applications: projects I've applied to (flow 4.3).
export default function MyApplicationsPage() {
  const [apps, setApps] = useState<Application[] | null>(null)

  useEffect(() => {
    api<{ applications: Application[] }>("/applications/mine")
      .then((d) => setApps(d.applications))
      .catch(() => setApps([]))
  }, [])

  if (apps === null) return <Loading />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Applications</h1>
        <p className="text-sm text-muted-foreground">Projects you've applied to.</p>
      </div>
      {apps.length === 0 ? (
        <EmptyState
          title="You haven't applied to anything yet"
          hint={<Link to="/projects" className="underline">Browse projects</Link>}
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {a.project ? (
                  <Link to={`/projects/${a.project_id}`} className="font-medium underline">
                    {a.project.title}
                  </Link>
                ) : (
                  <span className="font-medium">Project</span>
                )}
                <Badge>{a.project_role?.skill?.name ?? "Role"}</Badge>
                <Badge>{a.status}</Badge>
              </div>
              {a.pitch_note ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.pitch_note}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Applied {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}