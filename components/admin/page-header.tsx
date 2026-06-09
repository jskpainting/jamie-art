interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {eyebrow}
      </p>
      <h1 className="font-serif text-2xl md:text-3xl font-light tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}
