"use client"

import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: React.ElementType
  message: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-xl border border-dashed border-border">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
