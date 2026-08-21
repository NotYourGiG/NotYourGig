import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../lib/api"
import { Badge, Card, EmptyState, Loading } from "../components/ui"
import type { Profile } from "../lib/types"

// Public profile page per blueprint §5: header (name, headline, avatar,
// location), skills (tagged, leveled), proof cards, availability status.
export default function BuilderProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!userId) return
    api<{ user: Profile }>(`/users/${userId}`)
      .then((d) => setProfile(d.user))
      .catch(() => setNotFound(true))
  }, [userId])

  if (notFound) return <EmptyState title="User not found" />
  if (!profile) return <Loading />

  const links = (p: Profile["proof"][number]) =>
    [
      p.link_github && { href: p.link_github, label: "GitHub" },
      p.link_live_demo && { href: p.link_live_demo, label: "Live demo" },
      p.link_other && { href: p.link_other, label: "Link" },
    ].filter(Boolean) as Array<{ href: string; label: string }>

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
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
        </div>
      </div>

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
              <Badge key={us.skill.id}>
                {us.skill.name} · {us.level}
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