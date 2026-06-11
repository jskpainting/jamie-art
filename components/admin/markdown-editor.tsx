"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write some markdown…",
  rows = 8,
}: MarkdownEditorProps) {
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
        <TabsContent value="write" className="mt-1">
          <textarea
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
    </div>
  )
}
