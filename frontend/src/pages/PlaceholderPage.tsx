import type { ReactNode } from "react"

// Phase 1 scaffold placeholder for routes whose features are built in
// later sessions. Swapped for real pages per blueprint.md Build Order.
// `topContent` renders above the placeholder text (e.g. a non-functional
// search bar) so "coming soon" state feels intentional, not broken.
export default function PlaceholderPage({
  title,
  topContent,
}: {
  title: string
  topContent?: ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col px-6 py-10">
      {topContent ? <div className="mx-auto w-full max-w-xl">{topContent}</div> : null}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Phase 1 scaffold — feature builds here.
          </p>
        </div>
      </div>
    </main>
  )
}