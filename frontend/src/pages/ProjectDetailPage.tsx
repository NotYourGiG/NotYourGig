import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import { Badge, Button, Card, EmptyState, Loading, Textarea } from "../components/ui"
import type { Application, Project } from "../lib/types"

const TYPE_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  equity: "Equity",
  learning: "Learning",
}

// Project Detail (blueprint §5): description, roles + fill status, poster
// info, apply per role, and (for the poster) applicant review per flow 4.2.
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useCurrentUser()
  const [project, setProject] = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [applyingRoleId, setApplyingRoleId] = useState<string | null>(null)
  const [pitch, setPitch] = useState("")
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  const [applications, setApplications] = useState<Application[] | null>(null)

  useEffect(() => {
    if (!projectId) return
    api<{ project: Project }>(`/projects/${projectId}`)
      .then((d) => setProject(d.project))
      .catch(() => setNotFound(true))
  }, [projectId])

  const isPoster = Boolean(project && user && project.posted_by_user_id === user.id)

  useEffect(() => {
    if (!isPoster || !projectId) return
    api<{ applications: Application[] }>(`/projects/${projectId}/applications`)
      .then((d) => setApplications(d.applications))
      .catch(() => setApplications([]))
  }, [isPoster, projectId])

  if (notFound) return <EmptyState title="Project not found" />
  if (!project) return <Loading />

  async function submitApplication(roleId: string) {
    if (!project) return
    setSubmitMsg(null)
    try {
      await api("/applications", {
        method: "POST",
        body: {
          project_id: project.id,
          project_role_id: roleId,
          pitch_note: pitch.trim() || undefined,
        },
      })
      setSubmitMsg("Application sent. Good luck!")
      setApplyingRoleId(null)
      setPitch("")
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : "Failed to apply")
    }
  }

  async function decideApplication(appId: string, status: "accepted" | "rejected") {
    try {
      await api(`/applications/${appId}`, { method: "PATCH", body: { status } })
      setApplications((list) =>
        (list ?? []).map((a) => (a.id === appId ? { ...a, status } : a)),
      )
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : "Failed to update application")
    }
  }
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <img
              src="/logos/LogoPic.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-auto shrink-0"
            />
            <h1 className="text-2xl font-semibold">{project.title}</h1>
          </span>
          <Badge>{TYPE_LABELS[project.type] ?? project.type}</Badge>
          <Badge>{project.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {project.posted_by_user ? (
            <Link to={`/builders/${project.posted_by_user_id}`} className="underline">
              {project.posted_by_user.name}
            </Link>
          ) : project.posted_by_org ? (
            <span>{project.posted_by_org.name}</span>
          ) : null}
          {project.budget_amount != null && project.type === "paid" ? (
            <span>
              {project.budget_amount.toLocaleString()} {project.budget_currency}
            </span>
          ) : null}
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Overview</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.description}</p>
      </div>

      {submitMsg ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {submitMsg}
        </p>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Roles needed</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {project.roles?.map((r) => {
            const full = r.headcount_filled >= r.headcount_needed
            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.skill?.name ?? "Skill"}</p>
                  <Badge>{r.seniority}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.headcount_filled}/{r.headcount_needed} filled
                </p>
                {isLoaded && isSignedIn && project.status === "open" && !isPoster && !full ? (
                  applyingRoleId === r.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        rows={3}
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        placeholder="Optional pitch: why you, and what you've built"
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => submitApplication(r.id)}>Send application</Button>
                        <Button variant="ghost" onClick={() => { setApplyingRoleId(null); setPitch("") }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setApplyingRoleId(r.id)}
                    >
                      Apply for this role
                    </Button>
                  )
                ) : !isSignedIn ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <Link to="/sign-in" className="underline">Sign in</Link> to apply.
                  </p>
                ) : null}
              </Card>
            )
          })}
        </div>
      </div>

      {isPoster ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Applications</h2>
          {applications === null ? (
            <Loading />
          ) : applications.length === 0 ? (
            <EmptyState title="No applications yet" />
          ) : (
            <div className="space-y-3">
              {applications.map((a) => (
                <Card key={a.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {a.applicant?.name ?? "Applicant"} · {a.project_role?.skill?.name ?? "Role"}
                      </p>
                      {a.pitch_note ? (
                        <p className="mt-1 text-sm text-muted-foreground">{a.pitch_note}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{a.status}</Badge>
                      {a.status === "pending" ? (
                        <>
                          <Button variant="outline" onClick={() => decideApplication(a.id, "accepted")}>
                            Accept
                          </Button>
                          <Button variant="ghost" onClick={() => decideApplication(a.id, "rejected")}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}