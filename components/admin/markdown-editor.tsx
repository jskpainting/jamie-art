"use client"

import { useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Bold, Italic, Heading2, Link2, List, Quote, ImagePlus } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { PaintingPicker } from "@/components/admin/painting-picker"
import { SITE_URL } from "@/lib/site"
import type { PaintingForPicker } from "@/lib/db/queries"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  /** Shows a small formatting toolbar above the Write tab. Off by default so
   * existing call sites (e.g. the painting dialog) are unaffected. */
  toolbar?: boolean
  /** Paintings available for the toolbar's "Insert painting" button. Only
   * used when `toolbar` is true — omit to hide that button. */
  paintings?: PaintingForPicker[]
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write some markdown…",
  rows = 8,
  toolbar = false,
  paintings,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  function applyEdit(next: string, selectStart: number, selectEnd: number) {
    onChange(next)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(selectStart, selectEnd)
    })
  }

  /** Wraps the current selection with `prefix`/`suffix` (e.g. bold, italic, link). */
  function wrapSelection(prefix: string, suffix: string = prefix, placeholderText = "text") {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholderText
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
    applyEdit(next, start + prefix.length, start + prefix.length + selected.length)
  }

  /** Prefixes each selected line with `linePrefix` (e.g. bullet, quote, heading). */
  function prefixLines(linePrefix: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const lineEnd = end === start ? value.indexOf("\n", start) : end
    const effectiveEnd = lineEnd === -1 ? value.length : lineEnd
    const block = value.slice(lineStart, effectiveEnd)
    const prefixed = block
      .split("\n")
      .map((line) => (line.startsWith(linePrefix) ? line : linePrefix + line))
      .join("\n")
    const next = value.slice(0, lineStart) + prefixed + value.slice(effectiveEnd)
    applyEdit(next, lineStart, lineStart + prefixed.length)
  }

  function insertPainting(p: PaintingForPicker & { section_slug: string }) {
    const url = `${SITE_URL}/portfolio/${p.section_slug}/${p.slug}`
    const caption = p.story ? ` — ${p.story}` : ""
    const block = `![${p.title}](${p.primary_image_url ?? ""})\n**${p.title}**${caption}\n[See it](${url})\n\n`
    const el = textareaRef.current
    const pos = el?.selectionStart ?? value.length
    const next = value.slice(0, pos) + block + value.slice(pos)
    applyEdit(next, pos + block.length, pos + block.length)
    setPickerOpen(false)
  }

  return (
    <div className="space-y-1">
      <Tabs defaultValue="write">
        <TabsList className="h-8">
          <TabsTrigger value="write" className="text-xs h-7">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs h-7">
            Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-1 space-y-1">
          {toolbar && (
            <div className="flex items-center gap-0.5 overflow-x-auto rounded-md border border-input bg-muted/30 px-1 py-1">
              <ToolbarButton label="Bold" onClick={() => wrapSelection("**")}>
                <Bold className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Italic" onClick={() => wrapSelection("_")}>
                <Italic className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Heading" onClick={() => prefixLines("## ")}>
                <Heading2 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Link" onClick={() => wrapSelection("[", "](https://)", "link text")}>
                <Link2 className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Bullet list" onClick={() => prefixLines("- ")}>
                <List className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Quote" onClick={() => prefixLines("> ")}>
                <Quote className="h-3.5 w-3.5" />
              </ToolbarButton>
              {paintings && (
                <ToolbarButton label="Insert painting" onClick={() => setPickerOpen(true)}>
                  <ImagePlus className="h-3.5 w-3.5" />
                </ToolbarButton>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-1">
          <div
            className="min-h-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none"
          >
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">Nothing to preview.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">Markdown supported</p>

      {toolbar && paintings && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Insert a painting</DialogTitle>
            </DialogHeader>
            <PaintingPicker
              paintings={paintings}
              selectedId={null}
              onSelect={(id) => {
                const p = paintings.find((pp) => pp.id === id)
                if (p) insertPainting(p)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
