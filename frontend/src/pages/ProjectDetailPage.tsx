import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Pencil } from "lucide-react"
import { useAuth } from "@clerk/clerk-react"
import { api } from "../lib/api"
import { cn, normalizeUrl } from "../lib/utils"
import { useCurrentUser } from "../lib/user-context"
import { Badge, Button, Card, EmptyState, Loading, Textarea } from "../components/ui"
import ProjectForm, { type ProjectFormRole, type ProjectFormValues } from "../components/ProjectForm"
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

  const [applications, setApplications] = useState<Application[] | null>(null)
  const [editing, setEditing] = useState(false)

  // Small auto-dismissing toast (bottom corner) for action feedback — in
  // particular the "already a member" accept rejection and the apply-time
  // guard, which would otherwise look like a silent 400.
  const [toast, setToast] = useState<{ kind: "error" | "info"; text: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(text: string, kind: "error" | "info" = "error") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ kind, text })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

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

  // Edit mode (poster only): the shared ProjectForm, pre-filled and with
  // roles that have applicants locked (skill/seniority frozen, headcount
  // increase-only, no remove).
  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Edit Project</h1>
          <p className="text-sm text-muted-foreground">
            Update project details and roles. Roles with applicants are locked.
          </p>
        </div>
        <ProjectForm
          mode="edit"
          submitLabel="Save changes"
          initial={{
            title: project.title,
            description: project.description,
            repoUrl: project.repo_url ?? "",
            demoUrl: project.demo_url ?? "",
            type: project.type,
            status: project.status,
            budget: "",
            currency: "",
          }}
          initialRoles={project.roles.map((r) => ({
            id: r.id,
            skill: r.skill,
            seniority: r.seniority,
            headcount: r.headcount_needed,
          }))}
          lockedRoleIds={new Set(
            project.roles.filter((r) => (r.applications_count ?? 0) > 0).map((r) => r.id),
          )}
          onCancel={() => setEditing(false)}
          onSubmit={async (values: ProjectFormValues, roles: ProjectFormRole[]) => {
            const d = await api<{ project: Project }>(`/projects/${project.id}`, {
              method: "PATCH",
              body: {
                title: values.title,
                description: values.description,
                type: values.type,
                status: values.status,
                repo_url: values.repoUrl || null,
                demo_url: values.demoUrl || null,
                roles: roles.map((r) =>
                  r.id
                    ? { id: r.id, skill_id: r.skill!.id, seniority: r.seniority, headcount_needed: r.headcount }
                    : { skill_id: r.skill!.id, seniority: r.seniority, headcount_needed: r.headcount },
                ),
              },
            })
            setProject(d.project)
            setEditing(false)
            showToast("Project updated", "info")
          }}
        />
      </div>
    )
  }

  async function submitApplication(roleId: string) {
    if (!project) return
    try {
      await api("/applications", {
        method: "POST",
        body: {
          project_id: project.id,
          project_role_id: roleId,
          pitch_note: pitch.trim() || undefined,
        },
      })
      showToast("Application sent. Good luck!", "info")
      setApplyingRoleId(null)
      setPitch("")
    } catch (e) {
      // e.g. 400 "You cannot apply for another role in the same project"
      // or "You already applied to this role" — surfaced as a toast so a
      // rejection never looks like a silent failure.
      showToast(e instanceof Error ? e.message : "Failed to apply")
    }
  }

  async function decideApplication(appId: string, status: "accepted" | "rejected") {
    try {
      await api(`/applications/${appId}`, { method: "PATCH", body: { status } })
      setApplications((list) =>
        (list ?? []).map((a) => (a.id === appId ? { ...a, status } : a)),
      )
      showToast(status === "accepted" ? "Application accepted" : "Application rejected", "info")
    } catch (e) {
      // e.g. 400 "This person is already a member of this project — they
      // can't fill a second role" — must pop, not fail silently.
      showToast(e instanceof Error ? e.message : "Failed to update application")
    }
  }

  // Normalize user-supplied links (prepend https:// when bare, e.g.
  // "jokeverse-yb2z.vercel.app/") so they always render as external URLs
  // that open in a new tab, never as relative paths on this origin.
  const repoHref = normalizeUrl(project.repo_url)
  const demoHref = normalizeUrl(project.demo_url)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <img
              src="/assets/LogoPic.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-auto shrink-0"
            />
            <h1 className="text-2xl font-semibold">{project.title}</h1>
          </span>
          {isPoster ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit project"
              title="Edit project"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
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
        {(repoHref || demoHref) ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {repoHref ? (
              <a href={repoHref} target="_blank" rel="noreferrer" className="font-medium underline">
                View on GitHub
              </a>
            ) : null}
            {demoHref ? (
              <a href={demoHref} target="_blank" rel="noreferrer" className="font-medium underline">
                View Live Demo
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-md sm:right-4 sm:left-auto sm:max-w-sm",
            toast.kind === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-foreground",
          )}
        >
          <p className="min-w-0 flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="shrink-0 text-sm leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>
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
                        {a.applicant ? (
                          <Link to={`/builders/${a.applicant.id}`} className="underline">
                            {a.applicant.name}
                          </Link>
                        ) : (
                          "Applicant"
                        )}{" "}· {a.project_role?.skill?.name ?? "Role"}
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