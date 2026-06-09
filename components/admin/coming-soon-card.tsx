interface ComingSoonCardProps {
  description?: string
}

export function ComingSoonCard({
  description = "Full functionality will be built in Phase 4.",
}: ComingSoonCardProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <span className="inline-block text-xs uppercase tracking-[0.2em] font-medium bg-muted text-muted-foreground px-3 py-1 rounded-full mb-3">
        Coming in Phase 4
      </span>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
        {description}
      </p>
    </div>
  )
}
