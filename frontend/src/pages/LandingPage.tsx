import { Link } from "react-router-dom"
import { Card } from "../components/ui"

// Public landing page (blueprint §5 "Public" IA). Hero states the core
// philosophy; entry cards lead to the two primary, search-first surfaces
// (Browse Projects, Explore Builders) — both public per §5.
export default function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl pb-4 pt-16 text-center">
        <p className="mx-auto mb-5 inline-block rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Proof &gt; Resume
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Resumes tell.
          <br />
          <span className="text-muted-foreground">Proof demonstrates.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Not Your Gig is one platform for the three things builders need —
          find work, find talent, find teammates — built around what you've
          actually shipped, not what you claim on paper.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/projects"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse Projects
          </Link>
          <Link
            to="/builders"
            className="rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Explore Builders
          </Link>
        </div>
      </section>

      {/* Three entry points into the same core loop (blueprint §1), each
          pre-filtered and worded for its audience. */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link to="/projects?type=paid" className="group block">
          <Card className="h-full transition-colors group-hover:border-ring">
            <h2 className="text-base font-semibold">Find Work</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Paid and unpaid projects from founders and startups that hire on
              proof, not resumes. Start with paid gigs you can actually point to.
            </p>
            <p className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 group-hover:underline">
              Browse paid projects →
            </p>
          </Card>
        </Link>
        <Link to="/projects?poster=org" className="group block">
          <Card className="h-full transition-colors group-hover:border-ring">
            <h2 className="text-base font-semibold">Find Talent</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hire from live demos, repos, and past projects instead of guessing
              from a resume. See what companies are posting and who's proven.
            </p>
            <p className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 group-hover:underline">
              Browse company projects →
            </p>
          </Card>
        </Link>
        <Link to="/builders" className="group block">
          <Card className="h-full transition-colors group-hover:border-ring">
            <h2 className="text-base font-semibold">Find a Builder</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Find complementary teammates for your next build — the same loop,
              filtered for collaboration. Skills, availability, and proof.
            </p>
            <p className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 group-hover:underline">
              Explore builders →
            </p>
          </Card>
        </Link>
      </section>
    </div>
  )
}