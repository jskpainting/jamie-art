"use client"

import { useState, useRef } from "react"
import Papa from "papaparse"
import { toast } from "sonner"
import { importContacts } from "@/lib/actions/contacts"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ParsedRow {
  email?: string
  first_name?: string
  last_name?: string
  [key: string]: string | undefined
}

interface CsvImportProps {
  existingEmails: string[]
  className?: string
}

export function CsvImport({ existingEmails, className }: CsvImportProps) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const existingSet = new Set(existingEmails.map((e) => e.toLowerCase()))

  function handleFile(file: File) {
    setError(null)
    setRows([])
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const data = result.data
        if (!data.length) {
          setError("No rows found in CSV.")
          return
        }
        if (!("email" in data[0])) {
          setError('CSV must have an "email" column.')
          return
        }
        setRows(data)
      },
      error: () => setError("Failed to parse CSV — check the file format."),
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const validRows = rows.filter(
    (r) => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
  )
  const newRows = validRows.filter(
    (r) => !existingSet.has((r.email ?? "").toLowerCase())
  )
  const duplicateCount = validRows.length - newRows.length

  async function handleImport() {
    if (!newRows.length) return
    setImporting(true)
    try {
      const result = await importContacts(
        newRows.map((r) => ({
          email: r.email!,
          first_name: r.first_name,
          last_name: r.last_name,
        }))
      )
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(
          `${result.data?.inserted ?? 0} added, ${result.data?.skipped ?? 0} skipped`
        )
        setRows([])
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose CSV
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleChange}
        />
        {rows.length > 0 && (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {rows.length} row{rows.length !== 1 ? "s" : ""} loaded
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.length > 0 && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Preview table */}
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-xs min-w-[300px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">First name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Last name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.slice(0, 5).map((row, i) => {
                  const isDupe = existingSet.has((row.email ?? "").toLowerCase())
                  return (
                    <tr key={i} className={isDupe ? "opacity-50" : ""}>
                      <td className="px-3 py-2">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.first_name ?? "—"}</td>
                      <td className="px-3 py-2">{row.last_name ?? "—"}</td>
                      <td className="px-3 py-2">
                        {isDupe ? (
                          <span className="text-muted-foreground">duplicate</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">new</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length > 5 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                …and {rows.length - 5} more rows
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <span><strong>{validRows.length}</strong> valid</span>
            <span className="text-green-600 dark:text-green-400"><strong>{newRows.length}</strong> new</span>
            <span className="text-muted-foreground"><strong>{duplicateCount}</strong> duplicate{duplicateCount !== 1 ? "s" : ""}</span>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing || newRows.length === 0}
            size="sm"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {importing ? "Importing…" : `Import ${newRows.length} contact${newRows.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  )
}
