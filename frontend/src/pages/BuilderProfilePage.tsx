import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import { normalizeUrl } from "../lib/utils"
import { Badge, Button, Card, EmptyState, Loading } from "../components/ui"
import type { Conversation, Profile } from "../lib/types"

// Public profile page per blueprint §5: header (name, headline, avatar,
// location), skills (tagged, leveled), proof cards, availability status.
export default function BuilderProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  async function startChat() {
    if (!profile) return
    setStarting(true)
    setMessageError(null)
    try {
      const d = await api<{ conversation: Conversation }>("/conversations", {
        method: "POST",
        body: { user_id: profile.id },
      })
      navigate(`/chat?c=${d.conversation.id}`)
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Failed to start a conversation")
      setStarting(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    api<{ user: Profile }>(`/users/${userId}`)
      .then((d) => setProfile(d.user))
      .catch(() => setNotFound(true))
  }, [userId])

  if (notFound) return <EmptyState title="User not found" />
  if (!profile) return <Loading />

  const links = (p: Profile["proof"][number]) => {
    const githubHref = normalizeUrl(p.link_github)
    const demoHref = normalizeUrl(p.link_live_demo)
    const otherHref = normalizeUrl(p.link_other)
    return [
      githubHref && { href: githubHref, label: "GitHub" },
      demoHref && { href: demoHref, label: "Live demo" },
      otherHref && { href: otherHref, label: "Link" },
    ].filter(Boolean) as Array<{ href: string; label: string }>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-semibold text-muted-foreground">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            profile.name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{profile.name}</h1>
          {profile.headline ? <p className="mt-0.5 text-muted-foreground">{profile.headline}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {profile.location ? <span className="text-muted-foreground">{profile.location}</span> : null}
            <Badge>{profile.availability_status}</Badge>
            <Badge>{profile.primary_role}</Badge>
          </div>
          {profile.github_username ? (
            <p className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              <a
                href={`https://github.com/${profile.github_username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-muted-foreground underline transition-colors hover:text-foreground"
              >
                https://github.com/{profile.github_username}
              </a>
              {profile.github_connected_at ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  ✓ verified
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {profile.id !== user?.id ? (
          <div className="ml-auto shrink-0">
            {user ? (
              <Button variant="outline" onClick={startChat} disabled={starting}>
                {starting ? "Starting…" : "Message"}
              </Button>
            ) : (
              <Link
                to="/sign-in"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Message
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {messageError ? <p className="mt-1 text-xs text-destructive">{messageError}</p> : null}

      {profile.bio ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold">About</h2>
          <p className="text-sm text-muted-foreground">{profile.bio}</p>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Skills</h2>
        {profile.skills.length ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((us) => (
              <Badge key={us.skill.id} className="items-center gap-1">
                {us.skill.name} · {us.level}
                {us.verified_via === "github" ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    ✓ Verified from GitHub
                  </span>
                ) : null}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills listed.</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Proof of Work</h2>
        {profile.proof.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {profile.proof.map((p) => (
              <Card key={p.id}>
                <p className="font-medium">{p.title}</p>
                {p.role_played ? (
                  <p className="mt-1 text-xs text-muted-foreground">Role: {p.role_played}</p>
                ) : null}
                {p.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {links(p).map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="underline">
                      {l.label}
                    </a>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No proof of work yet.</p>
        )}
      </div>
    </div>
  )
}