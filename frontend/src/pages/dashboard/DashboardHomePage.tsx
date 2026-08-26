import { Link, Navigate } from "react-router-dom"
import { Card, Loading } from "../../components/ui"
import { useCurrentUser } from "../../lib/user-context"

const rows = [
  {
    to: "/projects?type=paid",
    title: "Find Internship",
    description: "Browse open opportunities",
    logo: "/assets/category/find-internship.png",
    alt: "Find Internship",
  },
  {
    to: "/projects?poster=org",
    title: "Find Talent",
    description: "Search builders by proof",
    logo: "/assets/category/find-talent.png",
    alt: "Find Talent",
  },
  {
    to: "/builders",
    title: "Find a Builder",
    description: "Connect with collaborators",
    logo: "/assets/category/find-builder.png",
    alt: "Find a Builder",
  },
]

// Dashboard home — three stacked entry rows, each with the category logo on
// the left (larger for a professional look), a bold title, and a one-line
// description. Vertical stack fills the page better while staying flat and
// minimal. Only reachable once GitHub is connected (the mandatory gate lives
// in DashboardLayout; the check here is a backstop).
export default function DashboardHomePage() {
  const { user, loading } = useCurrentUser()

  if (loading) return <Loading />
  if (user && !user.github_connected_at) {
    return <Navigate to="/dashboard/profile" replace />
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Link key={r.to} to={r.to} className="group block">
          <Card className="items-center gap-5 px-6 py-6 transition-colors group-hover:border-ring flex">
            <img
              src={r.logo}
              alt={r.alt}
              className="h-16 w-16 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{r.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}