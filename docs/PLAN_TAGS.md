# Plan — tags: manage in Settings, pick from a list on each painting

Owner's ask (13 Sep 2026): related paintings should work from tags; a
Settings section to define/manage all tags; on a painting, add a tag from a
dropdown or choose "Other" to type a new one, which then joins the list.

## What already exists (no migration needed)

- Tables `tags(id, name unique lowercase ≤50)` and `painting_tags` (both
  applied; **0 rows today**).
- `lib/actions/tags.ts` `updatePaintingTags(paintingId, names[])` — upserts
  tags by name and syncs the join rows.
- `lib/db/queries.ts` `getRelatedPaintings()` — **already tag-based**: ranks
  other paintings by number of shared tags, then fills the rest from the same
  gallery. With zero tags it silently falls back to "More from <gallery>".
- `components/admin/tag-input.tsx` — free-text type-ahead (fetches
  `/api/tags?q=`); no browsing of the full list, no "pick from dropdown".
- `TagNamesSchema` in `lib/schemas.ts` (trim + lowercase).

So the missing pieces are purely admin UI + two small actions.

## Deliverables

### 1. `lib/actions/tags.ts` — add
- `getAllTags(): { ok, tags: { id, name, inUse: number }[] }` — every tag with
  its painting count (`painting_tags` grouped client-side; 2 small selects),
  sorted by name.
- `createTag(name)` — normalise like `TagNamesSchema` (trim, lowercase,
  collapse spaces, 1–50 chars); upsert; returns the row.
- `renameTag(id, name)` — same validation; `23505` → "That tag already exists".
- `deleteTag(id)` — cascade removes it from paintings (FK on delete cascade);
  confirm in UI when `inUse > 0`.
- All: `getUser()` guard, Zod, `revalidatePath("/admin/settings")`,
  `revalidatePath("/portfolio", "layout")`, `revalidatePath("/admin/portfolio", "layout")`.

### 2. `components/admin/tag-picker.tsx` (new, replaces `TagInput` everywhere)
Props `{ value: string[]; onChange(names: string[]); allTags: string[] }`.
- Selected tags as removable chips (existing chip styling from `tag-input.tsx`).
- Underneath, the same pattern as `OptionSelect`: a native `<select>` whose
  options are the tags NOT yet selected, plus "Other…" (type a new tag). Picking
  an option adds it immediately and resets the select; "Other…" swaps to an
  `Input` with Enter / "Add" / "Back to list". New names are normalised
  (lowercase, trimmed) and added to the local list at once; they're created in
  the DB on save through the existing `updatePaintingTags` upsert.
- Empty-list state: "No tags yet — type one, or add them in Settings → Tags."
- Delete `components/admin/tag-input.tsx` and `/api/tags` only if nothing else
  imports them after the switch (grep first; keep the API if the public site
  uses it).

### 3. Painting form + bulk upload
- `painting-form-dialog.tsx`: load `getAllTags()` alongside `getFieldOptions()`
  when the dialog opens; render `<TagPicker>` where `TagInput` was. Helper text
  under it: "Paintings that share tags appear under 'Related work' on each
  other's pages."
- `bulk-upload-client.tsx`: the Defaults card gets a Tags row (same picker) so
  a whole batch can be tagged once; per-card Details keeps its picker. Keep all
  existing behaviour.

### 4. Settings card "Tags" (`app/admin/(authed)/settings/tags-card.tsx`)
Place right after "Painting details lists". Intro: "Tags connect paintings.
When two paintings share a tag, they show up as 'Related work' on each
other's pages. Add a few here, then pick them on each painting."
- Rows: tag name (click to rename inline, Enter to save), "on N paintings",
  ✕ (ConfirmDialog when N > 0: "Remove this tag from N paintings?").
- Bottom: Input + "Add tag". Chips-style list on desktop, one per line on
  mobile. Server page passes `initialTags` from `getAllTags()`.

### 5. Public detail page
No change: `getRelatedPaintings` already prefers tags. Confirm the heading
switches from "More from <gallery>" to "Related work" once two paintings share
a tag (curl the page after tagging two paintings locally — then untag them;
never leave test data).

## Verification
`npx tsc --noEmit`, `npm run lint`; curl `/admin/settings` contains "Tags";
`/admin/portfolio/abstracts` 200; painting dialog HTML unaffected (client
component). No DB writes except the explicit tag/untag test above, restored.
