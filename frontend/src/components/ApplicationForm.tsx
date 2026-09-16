import { useState } from "react"
import { Button, Input, Label, Textarea } from "./ui"
import type { Skill, User, UserSkill } from "../lib/types"

const LEVEL_RANK: Record<string, number> = {
  expert: 3,
  advanced: 2,
  intermediate: 1,
  beginner: 0,
}

// Lightweight application form: a read-only applicant strip (avatar, name,
// GitHub link + verified badge, top 2-3 skills with the role's skill ranked
// first), a required pitch, and an optional relevant-work URL.
export default function ApplicationForm({
  user,
  roleSkill,
  skills,
  onSubmit,
  onCancel,
}: {
  user: User
  roleSkill: Skill | null
  skills: UserSkill[]
  onSubmit: (pitch: string, relevantWorkUrl: string) => Promise<void>
  onCancel: () => void
}) {
  const [pitch, setPitch] = useState("")
  const [relevantWork, setRelevantWork] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Top skills, computed here from existing data: the role's skill first (if
  // the applicant has it), then the rest by level, then name — top 3.
  const topSkills = [...skills]
    .sort((a, b) => {
      const aMatch = a.skill?.id === roleSkill?.id
      const bMatch = b.skill?.id === roleSkill?.id
      if (aMatch !== bMatch) return aMatch ? -1 : 1
      const la = LEVEL_RANK[a.level] ?? 0
      const lb = LEVEL_RANK[b.level] ?? 0
      if (la !== lb) return lb - la
      return (a.skill?.name ?? "").localeCompare(b.skill?.name ?? "")
    })
    .slice(0, 3)

  const githubUrl = user.github_username
    ? `https://github.com/${user.github_username}`
    : null
  const verified = Boolean(user.github_connected_at)

  async function send() {
    if (pitch.trim().length < 20 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(pitch.trim(), relevantWork.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply")
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Read-only applicant strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          {githubUrl ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
            >
              {githubUrl}
              {verified ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  ✓ verified
                </span>
              ) : null}
            </a>
          ) : null}
        </div>
        {topSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {topSkills.map((us) => (
              <span
                key={us.skill?.id ?? us.skill?.name ?? "?"}
                className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {us.skill?.name ?? "?"}
                {us.verified_via === "github" ? <span className="text-primary"> ✓</span> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <Label>Why are you a good fit for this role? *</Label>
        <Textarea
          rows={3}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="A sentence on why you, and what you've built that's relevant."
        />
        <p className="text-xs text-muted-foreground">
          {Math.max(0, 20 - pitch.trim().length)} characters to go
        </p>
      </div>

      <div>
        <Label>Link to relevant work (optional)</Label>
        <Input
          value={relevantWork}
          onChange={(e) => setRelevantWork(e.target.value)}
          placeholder="https://… a live demo, past project, or something specific to this role"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={send} disabled={submitting || pitch.trim().length < 20}>
          {submitting ? "Sending…" : "Send application"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}