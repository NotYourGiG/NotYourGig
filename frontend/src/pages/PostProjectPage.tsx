import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import { Button, Card, Input, Label, Select, Textarea } from "../components/ui"
import type { Project, Skill } from "../lib/types"

interface RoleDraft {
  skill: Skill | null
  seniority: string
  headcount: number
}

const emptyRole = (): RoleDraft => ({ skill: null, seniority: "any", headcount: 1 })

// Post a Project (flow 4.2): title, description, type, optional budget,
// one or more roles. Posted as the current user (orgs are deferred).
export default function PostProjectPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("unpaid")
  const [budget, setBudget] = useState("")
  const [currency, setCurrency] = useState("INR")
  const [roles, setRoles] = useState<RoleDraft[]>([emptyRole()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!user || !title.trim() || !description.trim()) return
    const cleanRoles = roles.filter((r) => r.skill)
    if (cleanRoles.length === 0) {
      setError("Add at least one role with a skill")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const d = await api<{ project: Project }>("/projects", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          type,
          budget_amount: type === "paid" && budget ? Number(budget) : undefined,
          budget_currency: currency,
          posted_by_user_id: user.id,
          roles: cleanRoles.map((r) => ({
            skill_id: r.skill!.id,
            seniority: r.seniority,
            headcount_needed: r.headcount,
          })),
        },
      })
      navigate(`/projects/${d.project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post project")
      setSubmitting(false)
    }
  }

  function updateRole(index: number, patch: Partial<RoleDraft>) {
    setRoles((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Post a Project</h1>
        <p className="text-sm text-muted-foreground">
          Find people who can prove they can do the work.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Realtime dashboard for a fintech MVP" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you building, and what does success look like?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="equity">Equity</option>
                <option value="learning">Learning collab</option>
              </Select>
            </div>
            {type === "paid" ? (
              <>
                <div>
                  <Label>Budget (in cents)</Label>
                  <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 50000" />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Roles needed</h2>
        <div className="space-y-4">
          {roles.map((role, index) => (
            <RoleEditor
              key={index}
              role={role}
              index={index}
              onChange={updateRole}
              onRemove={(i) => setRoles((rs) => rs.filter((_, x) => x !== i))}
            />
          ))}
          <Button variant="outline" onClick={() => setRoles((rs) => [...rs, emptyRole()])}>
            Add another role
          </Button>
        </div>
      </Card>

      <Button
        onClick={submit}
        disabled={submitting || !title.trim() || !description.trim()}
        className="w-full"
      >
        {submitting ? "Publishing…" : "Publish project"}
      </Button>
    </div>
  )
}
// One role row editor: curated skill search (no free text), seniority,
// headcount. onChange(index, patch) keeps the parent state as the source
// of truth.
function RoleEditor({
  role,
  index,
  onChange,
  onRemove,
}: {
  role: RoleDraft
  index: number
  onChange: (index: number, patch: Partial<RoleDraft>) => void
  onRemove: (index: number) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Skill[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setQuery(role.skill ? role.skill.name : "")
  }, [role.skill])

  async function search(q: string) {
    setQuery(q)
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

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Role {index + 1}</p>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_110px]">
        <div>
          <Label>Skill</Label>
          <Input
            value={role.skill ? role.skill.name : query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search the curated skills…"
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-44 w-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(index, { skill: s })
                      setResults([])
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <Label>Seniority</Label>
          <Select
            value={role.seniority}
            onChange={(e) => onChange(index, { seniority: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </Select>
        </div>
        <div>
          <Label>Headcount</Label>
          <Input
            type="number"
            min={1}
            value={role.headcount}
            onChange={(e) =>
              onChange(index, { headcount: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
      </div>
      {searching ? <p className="mt-1 text-xs text-muted-foreground">Searching…</p> : null}
    </div>
  )
}