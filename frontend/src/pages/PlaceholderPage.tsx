// Phase 1 scaffold placeholder for routes whose features are built in
// later sessions. Swapped for real pages per blueprint.md Build Order.
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Phase 1 scaffold — feature builds here.</p>
      </div>
    </main>
  )
}