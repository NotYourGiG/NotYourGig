import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../lib/api"
import { Badge, EmptyState, Input, Label, Loading, Select } from "../components/ui"
import type { Page, Project, Skill } from "../lib/types"

const TYPE_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  equity: "Equity",
  learning: "Learning",
}

// Browse Projects (blueprint §5) — public, filters per §4.3
// (paid/unpaid, skill, org vs individual), paginated per §8.
export default function BrowseProjectsPage() {
  const [type, setType] = useState("")
  const [poster, setPoster] = useState("")
  const [status, setStatus] = useState("")
  const [skill, setSkill] = useState<Skill | null>(null)
  const [skillQuery, setSkillQuery] = useState("")
  const [skillResults, setSkillResults] = useState<Skill[]>([])
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Page<Project> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: "10" })
    if (type) params.set("type", type)
    if (poster) params.set("poster", poster)
    if (status) params.set("status", status)
    if (skill) params.set("skill_id", skill.id)
    try {
      setResult(await api<Page<Project>>(`/projects?${params}`))
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [type, poster, status, skill, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    if (!skillQuery.trim()) {
      setSkillResults([])
      return
    }
    const t = setTimeout(() => {
      api<{ skills: Skill[] }>(`/skills?q=${encodeURIComponent(skillQuery)}`)
        .then((d) => setSkillResults(d.skills))
        .catch(() => setSkillResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [skillQuery])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.per_page)) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Browse Projects</h1>
        <p className="text-sm text-muted-foreground">
          Paid and unpaid work from people and orgs that value proof.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
            <option value="">All</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Posted by</Label>
          <Select value={poster} onChange={(e) => { setPoster(e.target.value); setPage(1) }}>
            <option value="">Anyone</option>
            <option value="individual">Individual</option>
            <option value="org">Organization</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
        <div>
          <Label>Skill needed</Label>
          <Input
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
            placeholder={skill ? skill.name : "Search skills…"}
          />
          {skillResults.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-44 w-52 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {skillResults.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { setSkill(s); setSkillQuery(s.name); setSkillResults([]); setPage(1) }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {skill && (
            <button
              type="button"
              onClick={() => { setSkill(null); setSkillQuery(""); setPage(1) }}
              className="mt-1 text-xs text-muted-foreground underline"
            >
              Clear skill filter
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : !result || result.data.length === 0 ? (
        <EmptyState title="No projects match these filters" hint="Try clearing a filter." />
      ) : (
        <div className="space-y-3">
          {result.data.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-ring"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{p.title}</h2>
                <Badge>{TYPE_LABELS[p.type] ?? p.type}</Badge>
                <Badge>{p.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {p.posted_by_user ? <span>{p.posted_by_user.name}</span> : null}
                {p.posted_by_org ? <span>{p.posted_by_org.name}</span> : null}
                {p.budget_amount != null && p.type === "paid" ? (
                  <span>
                    {p.budget_amount.toLocaleString()} {p.budget_currency}
                  </span>
                ) : null}
                {p.roles?.map((r) => (
                  <Badge key={r.id} className="bg-muted">
                    {r.skill?.name ?? "?"} {r.headcount_filled}/{r.headcount_needed}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {result && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border bg-background px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border bg-background px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}