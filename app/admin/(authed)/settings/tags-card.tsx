"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { createTag, renameTag, deleteTag, type TagWithUsage } from "@/lib/actions/tags"

interface TagsCardProps {
  initialTags: TagWithUsage[]
}

function TagRow({
  tag,
  onChanged,
}: {
  tag: TagWithUsage
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRename() {
    if (!name.trim() || name.trim() === tag.name) {
      setEditing(false)
      setName(tag.name)
      return
    }
    setSaving(true)
    try {
      const result = await renameTag(tag.id, name)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't rename that tag", { duration: 5000 })
        setName(tag.name)
        return
      }
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setRemoving(true)
    try {
      const result = await deleteTag(tag.id)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't remove that tag", { duration: 5000 })
        return
      }
      onChanged()
    } finally {
      setRemoving(false)
    }
  }

  const removeButton = (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={removing}
      aria-label={`Remove ${tag.name}`}
      onClick={tag.inUse === 0 ? handleDelete : undefined}
    >
      {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </Button>
  )

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleRename()
                } else if (e.key === "Escape") {
                  setEditing(false)
                  setName(tag.name)
                }
              }}
              className="h-8"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={saving}
              onClick={handleRename}
              aria-label="Save"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left w-full"
          >
            <p className="text-sm truncate">{tag.name}</p>
            <p className="text-xs text-muted-foreground">
              {tag.inUse > 0
                ? `on ${tag.inUse} painting${tag.inUse !== 1 ? "s" : ""}`
                : "not used"}
            </p>
          </button>
        )}
      </div>
      {!editing &&
        (tag.inUse > 0 ? (
          <ConfirmDialog
            trigger={removeButton}
            title="Remove this tag?"
            description={`Remove this tag from ${tag.inUse} painting${tag.inUse !== 1 ? "s" : ""}? Paintings keep everything else — it just won't be tagged with this any more.`}
            confirmLabel="Remove"
            destructive
            onConfirm={handleDelete}
          />
        ) : (
          removeButton
        ))}
    </li>
  )
}

export function TagsCard({ initialTags }: TagsCardProps) {
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const result = await createTag(newName)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't add that tag", { duration: 5000 })
        return
      }
      setNewName("")
      router.refresh()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tags connect paintings. When two paintings share a tag, they show up
        as &ldquo;Related work&rdquo; on each other&rsquo;s pages. Add a few
        here, then pick them on each painting.
      </p>
      {initialTags.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {initialTags.map((tag) => (
            <TagRow key={tag.id} tag={tag} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a tag…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add tag"}
        </Button>
      </div>
    </div>
  )
}
