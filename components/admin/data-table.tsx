"use client"

import { cn } from "@/lib/utils"

export interface TableColumn {
  key: string
  label: string
  className?: string
}

interface DataTableProps {
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  renderCell: (row: Record<string, unknown>, key: string) => React.ReactNode
  actions?: (row: Record<string, unknown>) => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
}

export function DataTable({
  columns,
  rows,
  renderCell,
  actions,
  emptyState,
  className,
}: DataTableProps) {
  if (rows.length === 0 && emptyState) {
    return <div>{emptyState}</div>
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full text-sm min-w-[500px]">
        <thead className="sticky top-0 z-10 bg-card border-b border-border">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
            {actions && (
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr
              key={i}
              className="hover:bg-muted/40 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3 text-foreground", col.className)}
                >
                  {renderCell(row, col.key)}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {actions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
