import { useState } from "react"
import { api } from "../lib/api"
import { Button, Card, Input, Label, Select, Textarea } from "../components/ui"
import type { Skill } from "../lib/types"

export type ProjectFormMode = "create" | "edit"

export interface ProjectFormRole {
  /** DB id for existing roles; absent for roles being added. */
  id?: string
  skill: Skill | null
  seniority: string
  headcount: number
}

export interface ProjectFormValues {
  title: string
  description: string
  repoUrl: string
  demoUrl: string
  type: string
  status: string
  budget: string
  currency: string
}

const TYPE_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  equity: "Equity",
  learning: "Learning",
}
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}
const SENIORITIES = ["any", "junior", "mid", "senior"]

let localCounter = 0
const nextLocalId = (): string => `role-${++localCounter}`

export function emptyProjectFormRole(): ProjectFormRole {
  return { skill: null, seniority: "any", headcount: 1 }
}

// One editable role row. A locked role (has applications) freezes the skill
// and seniority controls, makes the slot count increase-only, and hides the
// remove button — mirroring the backend reconciliation rules.
function RoleRow({
  role,
  index,
  locked,
  onChange,
  onRemove,
}: {
  role: ProjectFormRole
  index: number
  locked: boolean
  onChange: (patch: Partial<ProjectFormRole>) => void
  onRemove: () => void
}) {
  const [query, setQuery] = useState(role.skill?.name ?? "")
  const [results, setResults] = useState<Skill[]>([])
  const [searching, setSearching] = useState(false)

  async function search(q: string) {
    setQuery(q)
    // Typing over a selected skill drops it from the draft, so the field
    // behaves like a normal text input (fresh suggestions at any point).
    if (role.skill && q !== role.skill.name) onChange({ skill: null })
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const d = await api<{ skills: Skill[] }>(`/skills?q=${encodeURIComponent(q)}`)
      setResults(d.skills)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function selectSkill(s: Skill) {
    setQuery(s.name)
    setResults([])
    onChange({ skill: s })
  }

  const minHeadcount = locked ? role.headcount : 1

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Role {index + 1}</p>
        {locked ? (
          <p className="text-xs text-muted-foreground">Can't edit — has applicants</p>
        ) : (
          <button type="button" onClick={onRemove} className="text-xs text-muted-foreground transition-colors hover:text-destructive">
            Remove
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_110px]">
        <div>
          <Label>Skill</Label>
          {locked ? (
            <Input value={role.skill?.name ?? ""} disabled />
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Search the curated skills…"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-44 w-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {results.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => selectSkill(s)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div>
          <Label>Seniority</Label>
          <Select
            value={role.seniority}
            disabled={locked}
            onChange={(e) => onChange({ seniority: e.target.value })}
          >
            {SENIORITIES.map((v) => (
              <option key={v} value={v}>
                {v === "any" ? "Any" : v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Headcount</Label>
          <Input
            type="number"
            min={minHeadcount}
            value={role.headcount}
            onChange={(e) =>
              onChange({ headcount: Math.max(minHeadcount, Number(e.target.value) || minHeadcount) })
            }
          />
        </div>
      </div>
      {searching ? <p className="mt-1 text-xs text-muted-foreground">Searching…</p> : null}
    </div>
  )
}

export default function ProjectForm({
  mode = "create",
  initial,
  initialRoles,
  lockedRoleIds = new Set<string>(),
  submitLabel,
  onCancel,
  onSubmit,
}: {
  mode?: ProjectFormMode
  initial: ProjectFormValues
  initialRoles: ProjectFormRole[]
  lockedRoleIds?: Set<string>
  submitLabel: string
  onCancel?: () => void
  onSubmit: (values: ProjectFormValues, roles: ProjectFormRole[]) => Promise<void>
}) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [repoUrl, setRepoUrl] = useState(initial.repoUrl)
  const [demoUrl, setDemoUrl] = useState(initial.demoUrl)
  const [type, setType] = useState(initial.type)
  const [status, setStatus] = useState(initial.status)
  const [budget, setBudget] = useState(initial.budget)
  const [currency, setCurrency] = useState(initial.currency)
  const [roles, setRoles] = useState<ProjectFormRole[]>(() =>
    initialRoles.map((r) => ({ ...r, id: r.id ?? nextLocalId() })),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!title.trim() || !description.trim()) return
    const cleanRoles = roles.filter((r) => r.skill)
    if (cleanRoles.length === 0) {
      setError("Add at least one role with a skill")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim(),
          demoUrl: demoUrl.trim(),
          type,
          status,
          budget,
          currency,
        },
        cleanRoles,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
      setSubmitting(false)
    }
  }

  function updateRole(index: number, patch: Partial<ProjectFormRole>) {
    setRoles((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function addRole() {
    setRoles((rs) => [...rs, { ...emptyProjectFormRole(), id: nextLocalId() }])
  }
  function removeRole(index: number) {
    setRoles((rs) => rs.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Realtime dashboard for a fintech MVP"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you building, and what does success look like?"
            />
          </div>
          <div>
            <Label>GitHub Repo URL</Label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo (optional)"
            />
          </div>
          <div>
            <Label>Live Demo URL</Label>
            <Input
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://yourapp.vercel.app (optional)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            {mode === "edit" ? (
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            ) : type === "paid" ? (
              <>
                <div>
                  <Label>Budget (in cents)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Roles needed</h2>
            <Button type="button" variant="outline" onClick={addRole}>
              Add another role
            </Button>
          </div>
          {roles.map((role, index) => (
            <RoleRow
              key={role.id}
              role={role}
              index={index}
              locked={Boolean(role.id && lockedRoleIds.has(role.id))}
              onChange={(patch) => updateRole(index, patch)}
              onRemove={() => removeRole(index)}
            />
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}