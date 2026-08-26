import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useCurrentUser } from "../../lib/user-context"
import { api } from "../../lib/api"
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Loading,
  Select,
  Textarea,
} from "../../components/ui"
import type { Profile, ProofEntry, Skill, UserSkill } from "../../lib/types"
import ProofSection from "./ProofSection"

// Dashboard -> My Profile (blueprint §5): edit headline/bio/location/
// availability, add skills from the curated table (no free text, §6),
// add Proof of Work entries.
export default function ProfilePage() {
  const { user, loading, refresh } = useCurrentUser()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)

  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [availability, setAvailability] = useState("available")
  const [primaryRole, setPrimaryRole] = useState("builder")
  const [saving, setSaving] = useState(false)

  const [skillQuery, setSkillQuery] = useState("")
  const [skillResults, setSkillResults] = useState<Skill[]>([])
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [selectedLevel, setSelectedLevel] = useState("intermediate")

  const [error, setError] = useState<string | null>(null)

  // GitHub connect (proof-of-work) UI state.
  const [connecting, setConnecting] = useState(false)
  const [githubMessage, setGithubMessage] = useState<string | null>(null)
  // Read once: after the OAuth callback the backend 302s back here with
  // ?github=verified|none|error so we can show a non-breaking note.
  const [githubResult] = useState(
    () => new URLSearchParams(window.location.search).get("github"),
  )

  useEffect(() => {
    if (!githubResult) return
    window.history.replaceState({}, "", window.location.pathname)
    if (githubResult === "verified") {
      setGithubMessage("GitHub connected — verified skills are marked with a badge below.")
    } else if (githubResult === "none") {
      setGithubMessage(
        "GitHub connected, but none of your repo languages matched a skill you’ve added yet.",
      )
    } else {
      setGithubMessage("GitHub connection didn’t complete. You can try again.")
    }
    refresh() // re-sync users row so github_connected_at / username update
  }, [githubResult, refresh])

  useEffect(() => {
    if (!user) return
    api<{ user: Profile }>(`/users/${user.id}`)
      .then((d) => setProfile(d.user))
      .catch(() => setProfile(null))
  }, [user])

  useEffect(() => {
    if (!user) return
    setHeadline(user.headline ?? "")
    setBio(user.bio ?? "")
    setLocation(user.location ?? "")
    setAvailability(user.availability_status)
    setPrimaryRole(user.primary_role)
  }, [user])

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

  if (loading) return <Loading />

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await api(`/users/${user.id}`, {
        method: "PATCH",
        body: {
          headline,
          bio,
          location,
          availability_status: availability,
          primary_role: primaryRole,
        },
      })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  async function addSkill() {
    if (!user || !selectedSkill) return
    setError(null)
    try {
      const d = await api<{ skills: UserSkill[] }>(`/users/${user.id}/skills`, {
        method: "POST",
        body: { skill_id: selectedSkill.id, level: selectedLevel },
      })
      setProfile((p) => (p ? { ...p, skills: d.skills } : p))
      setSelectedSkill(null)
      setSkillQuery("")
      setSkillResults([])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add skill")
    }
  }

  // GET /auth/github/connect returns the GitHub authorize URL; navigate the
  // browser there. On success/failure the callback 302s back to this page
  // with ?github=…, so any error only shows the inline note — it never
  // breaks the profile.
  async function connectGithub() {
    if (!user) return
    setConnecting(true)
    setError(null)
    setGithubMessage(null)
    try {
      const d = await api<{ url: string; state_token: string }>("/auth/github/connect")
      // Keep the one-time state token in this tab's sessionStorage so the
      // profile can correlate the OAuth roundtrip; it is NOT used for CSRF
      // on its own (the backend verifies + consumes it server-side on the
      // callback via GitHub's `state` echo). Storing it is harmless and
      // keeps the connect metadata available if needed after navigation.
      sessionStorage.setItem("nyg_gh_state_token", d.state_token)
      window.location.href = d.url
      // component will be unloaded on redirect; reset for safety if not
      setConnecting(false)
    } catch (e) {
      setConnecting(false)
      setError(e instanceof Error ? e.message : "Couldn't start GitHub connect")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Proof &gt; Resume — this is what others see when they find you.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Mandatory GitHub connect: until github_connected_at is set, this is
          the only dashboard page available (DashboardLayout redirects every
          other dashboard route here) and the Skills section shows Connect. */}
      {user && !user.github_connected_at ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">
            Connect your GitHub to continue — this is how we verify real work
            on NotYourGig.
          </p>
        </div>
      ) : null}
      <Card>
        <h2 className="mb-4 text-sm font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Headline</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Full-stack builder shipping real products"
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bangalore, remote"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Bio</Label>
            <Textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What have you actually built?"
            />
          </div>
          <div>
            <Label>Availability</Label>
            <Select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="not_looking">Not looking</option>
            </Select>
          </div>
          <div>
            <Label>Primary role</Label>
            <Select value={primaryRole} onChange={(e) => setPrimaryRole(e.target.value)}>
              <option value="builder">Builder</option>
              <option value="founder">Founder</option>
              <option value="both">Both</option>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Skills</h2>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
          {user?.github_connected_at ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">GitHub</span>
              {user.github_username ? (
                <a
                  href={`https://github.com/${user.github_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  @{user.github_username}
                </a>
              ) : (
                <span className="font-medium">connected</span>
              )}
              <Badge className="bg-primary/10 text-primary">✓ Verified</Badge>
            </div>
          ) : (
            <Button variant="outline" onClick={connectGithub} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect GitHub"}
            </Button>
          )}
        </div>

        {githubMessage ? (
          <p className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {githubMessage}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {profile?.skills.length ? (
            profile.skills.map((us) => (
              <Badge key={us.skill.id} className="items-center gap-1">
                {us.skill.name} · {us.level}
                {us.verified_via === "github" ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    ✓ Verified from GitHub
                  </span>
                ) : null}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No skills yet.</span>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label>Add a skill (choose from the curated list)</Label>
            <Input
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder="Search skills…"
            />
            {skillResults.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                {skillResults.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSkill(s)
                        setSkillQuery(s.name)
                        setSkillResults([])
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {s.name}
                      {s.category ? (
                        <span className="ml-2 text-xs text-muted-foreground">{s.category}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div className="w-40">
              <Label>Level</Label>
              <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </Select>
            </div>
            <Button variant="outline" onClick={addSkill} disabled={!selectedSkill}>
              Add skill
            </Button>
          </div>
        </div>
      </Card>

      {user ? (
        <ProofSection
          user={user}
          profile={profile}
          onUpdate={(proof: ProofEntry[]) => setProfile((p) => (p ? { ...p, proof } : p))}
          onError={(msg) => setError(msg)}
        />
      ) : null}

      {/* "I'm done, take me forward." Profile fields are saved individually
          (Save / Add skill / Add proof); this is just navigation to the
          3-category dashboard home. If GitHub isn't connected yet, the
          mandatory gate in DashboardLayout redirects back here. */}
      <div className="pt-2">
        <Button onClick={() => navigate("/dashboard")}>
          Save &amp; Continue to Dashboard
        </Button>
      </div>
    </div>
  )
}