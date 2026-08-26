import { useState } from "react"
import { api } from "../../lib/api"
import { Button, Card, Input, Label, Textarea } from "../../components/ui"
import type { ProofEntry, Profile } from "../../lib/types"

const emptyProof = {
  title: "",
  description: "",
  link_github: "",
  link_live_demo: "",
  link_other: "",
  role_played: "",
}

// Proof of Work editor: list of the user's proof cards + add form
// (blueprint §5 Profile Page: "Proof of Work (cards: title, links,
// description, role played)").
export default function ProofSection({
  user,
  profile,
  onUpdate,
  onError,
}: {
  user: { id: string }
  profile: Profile | null
  onUpdate: (proof: ProofEntry[]) => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState(emptyProof)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function deleteProof(entryId: string) {
    if (!window.confirm("Delete this proof of work entry?")) return
    setDeletingId(entryId)
    try {
      const d = await api<{ proof: ProofEntry[] }>(
        `/users/${user.id}/proof/${entryId}`,
        { method: "DELETE" },
      )
      onUpdate(d.proof)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to delete proof")
    } finally {
      setDeletingId(null)
    }
  }

  async function addProof() {
    if (!form.title.trim()) return
    setAdding(true)
    try {
      const d = await api<{ proof: ProofEntry[] }>(`/users/${user.id}/proof`, {
        method: "POST",
        body: {
          title: form.title,
          description: form.description || undefined,
          link_github: form.link_github || undefined,
          link_live_demo: form.link_live_demo || undefined,
          link_other: form.link_other || undefined,
          role_played: form.role_played || undefined,
        },
      })
      onUpdate(d.proof)
      setForm(emptyProof)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to add proof")
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Proof of Work</h2>
      <div className="mb-4 space-y-3">
        {profile?.proof.length ? (
          profile.proof.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{p.title}</p>
                <button
                  type="button"
                  onClick={() => deleteProof(p.id)}
                  disabled={deletingId === p.id}
                  aria-label="Delete proof entry"
                  title="Delete"
                  className="shrink-0 rounded p-1 text-sm leading-none text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  {deletingId === p.id ? "…" : "✕"}
                </button>
              </div>
              {p.role_played ? (
                <p className="mt-1 text-xs text-muted-foreground">Role: {p.role_played}</p>
              ) : null}
              {p.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {p.link_github ? (
                  <a href={p.link_github} target="_blank" rel="noreferrer" className="underline">
                    GitHub
                  </a>
                ) : null}
                {p.link_live_demo ? (
                  <a href={p.link_live_demo} target="_blank" rel="noreferrer" className="underline">
                    Live demo
                  </a>
                ) : null}
                {p.link_other ? (
                  <a href={p.link_other} target="_blank" rel="noreferrer" className="underline">
                    Link
                  </a>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No proof yet.</span>
        )}
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Built a realtime dashboard in React"
            />
          </div>
          <div>
            <Label>Role played</Label>
            <Input
              value={form.role_played}
              onChange={(e) => setForm((f) => ({ ...f, role_played: e.target.value }))}
              placeholder="What you specifically did"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What was the problem, and what did you ship?"
            />
          </div>
          <div>
            <Label>GitHub link</Label>
            <Input
              value={form.link_github}
              onChange={(e) => setForm((f) => ({ ...f, link_github: e.target.value }))}
              placeholder="https://github.com/…"
            />
          </div>
          <div>
            <Label>Live demo link</Label>
            <Input
              value={form.link_live_demo}
              onChange={(e) => setForm((f) => ({ ...f, link_live_demo: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Other link</Label>
            <Input
              value={form.link_other}
              onChange={(e) => setForm((f) => ({ ...f, link_other: e.target.value }))}
              placeholder="Portfolio, write-up, etc."
            />
          </div>
        </div>
        <Button onClick={addProof} disabled={adding || !form.title.trim()}>
          {adding ? "Adding…" : "Add proof"}
        </Button>
      </div>
    </Card>
  )
}