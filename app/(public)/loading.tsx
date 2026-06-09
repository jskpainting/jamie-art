export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 animate-pulse">
      {/* Eyebrow skeleton */}
      <div className="h-3 w-20 bg-muted rounded-full mb-4" />
      {/* Title skeleton */}
      <div className="h-10 w-64 bg-muted rounded-lg mb-12" />
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
