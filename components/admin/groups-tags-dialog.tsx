"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import {
  createGroup,
  renameGroup,
  deleteGroup,
  renameTag,
  deleteTag,
} from "@/lib/actions/crm"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import type { ContactGroup } from "@/lib/types"

interface GroupsTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: (ContactGroup & { member_count: number })[]
  tags: { name: string; inUse: number }[]
}

export function GroupsTagsDialog({ open, onOpenChange, groups, tags }: GroupsTagsDialogProps) {
  const [newGroupName, setNewGroupName] = useState("")
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState("")
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null)

  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const [savingTag, setSavingTag] = useState<string | null>(null)

  async function handleCreateGroup() {
    const name = newGroupName.trim()
    if (!name) return
    setCreatingGroup(true)
    try {
      const result = await createGroup(name)
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
      } else {
        toast.success("Group created", { duration: 5000 })
        setNewGroupName("")
      }
    } finally {
      setCreatingGroup(false)
    }
  }

  function startEditGroup(g: ContactGroup) {
    setEditingGroupId(g.id)
    setEditingGroupName(g.name)
  }

  async function handleRenameGroup(id: string) {
    const name = editingGroupName.trim()
    if (!name) return
    setSavingGroupId(id)
    try {
      const result = await renameGroup(id, name)
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
      } else {
        toast.success("Group renamed", { duration: 5000 })
        setEditingGroupId(null)
      }
    } finally {
      setSavingGroupId(null)
    }
  }

  async function handleRenameTag(oldName: string) {
    const name = editingTagName.trim()
    if (!name) return
    setSavingTag(oldName)
    try {
      const result = await renameTag(oldName, name)
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
      } else {
        toast.success("Tag renamed", { duration: 5000 })
        setEditingTag(null)
      }
    } finally {
      setSavingTag(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Groups & tags</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="groups">
          <TabsList className="w-full">
            <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
            <TabsTrigger value="tags" className="flex-1">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. High-paying customers"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateGroup()
                  }
                }}
              />
              <Button size="sm" onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()}>
                {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No groups yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {groups.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                    {editingGroupId === g.id ? (
                      <>
                        <Input
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameGroup(g.id)
                            if (e.key === "Escape") setEditingGroupId(null)
                          }}
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleRenameGroup(g.id)}
                          disabled={savingGroupId === g.id}
                          aria-label="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEditingGroupId(null)}
                          aria-label="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate">{g.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {g.member_count} {g.member_count === 1 ? "person" : "people"}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startEditGroup(g)}
                          aria-label="Rename group"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon-sm" variant="ghost" aria-label="Delete group">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                          title="Delete group"
                          description={`Delete "${g.name}"? People stay on your list, they just leave this group.`}
                          destructive
                          onConfirm={async () => {
                            const result = await deleteGroup(g.id)
                            if (!result.ok) throw new Error(result.error)
                            toast.success("Group deleted", { duration: 5000 })
                          }}
                        />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="tags" className="space-y-3 pt-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No tags yet — add one from a person&rsquo;s page.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {tags.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 px-3 py-2">
                    {editingTag === t.name ? (
                      <>
                        <Input
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameTag(t.name)
                            if (e.key === "Escape") setEditingTag(null)
                          }}
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleRenameTag(t.name)}
                          disabled={savingTag === t.name}
                          aria-label="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEditingTag(null)}
                          aria-label="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate">{t.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {t.inUse} {t.inUse === 1 ? "person" : "people"}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTag(t.name)
                            setEditingTagName(t.name)
                          }}
                          aria-label="Rename tag"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button size="icon-sm" variant="ghost" aria-label="Delete tag">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                          title="Delete tag"
                          description={`Remove "${t.name}" from everyone who has it?`}
                          destructive
                          onConfirm={async () => {
                            const result = await deleteTag(t.name)
                            if (!result.ok) throw new Error(result.error)
                            toast.success("Tag deleted", { duration: 5000 })
                          }}
                        />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
