# Plan — phone-first bulk upload that never silently fails

Owner's goal: upload paintings **from his phone**, fewest taps, and see plainly
why anything failed. Written 13 Sep 2026 for a Sonnet agent to implement.

## Root cause of "some upload, some fail" (verified today)

```
curl -X POST https://www.jamiekendrioski.com/api/admin/upload -F file=@6MB.jpg
→ HTTP 413  "Request Entity Too Large / FUNCTION_PAYLOAD_TOO_LARGE"
```

Vercel serverless functions reject request bodies over **4.5 MB** at the
edge, before our route runs. Bulk upload sends the **raw** file through
`/api/admin/upload` (`lib/storage/upload.ts` — no client compression; only a
10 MB client cap). Phone photos are typically 3–8 MB, so roughly half fail,
the 413 body is plain text (not JSON), and the catch shows the generic "Upload
failed". The single-painting cropper compresses first and mostly stays under
the limit, which is why it "usually works".

Two fixes, both required: (1) upload **directly to Supabase Storage** with a
signed upload URL so Vercel is never in the byte path; (2) shrink phone photos
in the browser before upload (4000 px long edge, JPEG q0.9 — the same ceiling
the cropper already uses via `IMAGE_PRESETS.painting.maxOutputPx`).

## Gaps found in the current bulk uploader (`bulk-upload-client.tsx`)

| # | Gap | Effect on the phone |
|---|---|---|
| 1 | Raw file through Vercel | 413 on most phone photos (above) |
| 2 | Errors reduced to "Upload failed" | Owner can't tell size vs network vs signed-out |
| 3 | `accept` is jpeg/png/webp only; iPhone default is HEIC | If iOS "Most Compatible" is off, photos are rejected with a type error and no hint |
| 4 | 4 parallel uploads | Mobile radios choke; more timeouts |
| 5 | No per-file progress | Looks frozen for 10–30 s per photo |
| 6 | No auto-retry; manual Retry per card | Each blip = one more tap |
| 7 | Phone screen lock / app switch pauses JS | Uploads stall; no wake lock, no resume on return |
| 8 | Details are per-card in a dialog; no shared defaults | Same medium/size/gallery typed N times |
| 9 | Failed rows in `bulkCreatePaintings` are dropped silently | "N added" is wrong (being fixed by the AR agent: returns `failed[]`) |
| 10 | Reloading the tab loses everything, including photos already uploaded | Wasted uploads; orphan files in storage |
| 11 | Titles from filenames like `IMG_4132` are saved as-is | Junk titles on the public site |
| 12 | Drop zone padding `p-12 md:p-20` + 5-column grid | Fine on desktop, cramped on 375 px |

## Design

### Phase 1 — Reliable uploads + honest errors (fixes gaps 1–7, 9)

**`app/api/admin/upload-url/route.ts`** (new, POST, `getUser()`-gated).
Body `{ bucket, contentType, folder? }` validated exactly like
`/api/admin/upload` (same `ALLOWED_BUCKETS`, `ALLOWED_FOLDERS`,
`ALLOWED_TYPES`). Generates `path = [folder/]uuid.ext`, calls
`createAdminClient().storage.from(bucket).createSignedUploadUrl(path)` and
returns `{ path, token, publicUrl }`. Never returns HTML; every branch is JSON
`{ error, code }` where `code` ∈ `unauthorized | bad-bucket | bad-type | storage`.

**`lib/storage/upload.ts`** — rewrite `uploadImage(bucket, file, opts?)`:
```ts
interface UploadOpts { folder?: "crops"; onProgress?: (pct: number) => void; signal?: AbortSignal; maxPx?: number }
```
1. `shrinkImage(file, maxPx = 4000)` (new `lib/image-shrink.ts`): decode with
   `createImageBitmap` (falls back to `<img>`), apply EXIF orientation (browsers
   do this in `createImageBitmap` with `imageOrientation: "from-image"`), draw
   to canvas if long edge > maxPx, export JPEG q0.9 (PNG stays PNG only if it
   has transparency — paintings don't; export JPEG). Return `{ blob, width,
   height }` so the caller no longer needs a separate `measureImage`.
   Skip re-encoding when the file is already JPEG ≤ maxPx and ≤ 3 MB.
2. POST `/api/admin/upload-url` → `{ path, token, publicUrl }`.
3. **XHR PUT** to
   `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${token}`
   with headers `Content-Type: image/jpeg`, `x-upsert: false`. XHR (not fetch)
   so `upload.onprogress` drives `onProgress`. This is exactly what
   `supabase-js` `uploadToSignedUrl` does; we do it by hand for progress.
4. Retry steps 2–3 up to 3× with backoff 1 s / 3 s / 8 s on network errors,
   timeouts and 5xx. Never retry 401/403/413/415.
5. Return `{ url: publicUrl, path, width, height }`.
Keep the old `/api/admin/upload` route (the cropper's "crops" folder and the
image editor still use it) but switch the cropper's `uploadBlob` and
`multi-image-upload.tsx` to the new `uploadImage` too, so every surface gets
the same limit-free path and progress. `MAX_SIZE` client cap → 40 MB
(after shrinking nothing is large anyway).

**`lib/upload-errors.ts`** (new): `explainUploadError(e: unknown): { headline: string; detail: string }`.
Plain English, no jargon in `headline`; the real technical message in `detail`.
Mapping (check in this order):
- offline / `TypeError: Failed to fetch` / XHR `onerror` → "No internet connection" / raw
- 401/403 → "You've been signed out — sign in again and retry"
- 413 → "This photo is too big for the server (X MB)" (should no longer happen)
- 415 / kind `type` → "This isn't a photo type we can use — JPEG, PNG or WebP only. iPhone: Settings → Camera → Formats → Most Compatible"
- HEIC by extension/type (`image/heic`, `.heic`, `.heif`) → same HEIC hint
- timeout / abort → "The upload took too long — weak signal? Try again"
- storage message contains "already exists" → "A file with this name already exists (try again — a new name is generated)"
- storage "Bucket not found" / "row-level security" → "The photo storage isn't set up right (technical: …)"
- 5xx → "The server had a problem — try again in a minute"
- fallback → "Upload failed" / `String(e)`
Every catch site uses it: `toast.error(headline, { description: detail, duration: 8000 })`
(Sonner supports `description`). Bulk cards show `headline`; tapping the
card's ⓘ shows `detail`.

**Concurrency**: `MAX_CONCURRENT = isTouch ? 2 : 4`
(`matchMedia("(pointer: coarse)")`). Global overall progress = mean of card
progress.

**Keep the phone awake + resume**: while `uploadingCount > 0` request
`navigator.wakeLock?.request("screen")` (release when idle; ignore errors);
add a `beforeunload` guard while uploading or with unsaved ready cards; on
`visibilitychange` → visible, call the queue drain again (stalled XHRs will
have errored and been retried).

**Server** `bulkCreatePaintings` (already returning `failed[]` after the AR
agent's change): also handle slug collisions — on `23505` retry once with
`-2`, `-3` suffix (max 5) instead of failing the row.

### Phase 2 — Phone-first screen (gaps 8, 11, 12)

Layout, top to bottom, mobile (`< sm`); desktop keeps the drop zone.

1. **Header** (existing `PageHeader`).
2. **Defaults card** ("Applies to every photo you add") — one row of compact
   fields: Gallery (select), Medium (`OptionSelect`), Size (`OptionSelect`),
   Year, Status, Price. Persist in `localStorage` (`bulk-upload:defaults:v1`)
   so next week's session starts pre-filled. Any change offers "Apply to all
   N photos already added" (inline button, not a dialog).
3. **Add buttons**, full width, 48 px tall: **"Choose photos"** (`<input
   type=file multiple accept="image/*">` — `image/*` so the iOS picker is not
   filtered; HEIC is caught with the friendly message) and a secondary
   **"Take a photo"** (`capture="environment"`). Desktop additionally shows
   the existing drop zone with reduced padding (`p-8`).
4. **Overall progress bar** + text: "Uploading 3 of 12 · 2 failed" and a
   **"Retry failed"** button when any failed.
5. **Card grid** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. Each card:
   square thumbnail with a thin progress bar overlay while uploading; title as
   an inline `<input>` (already exists) with amber "Needs a title" chip when
   the title matches `/^(img|image|photo|dsc|pxl|screenshot)[ _-]?\d*$/i`
   (default such titles to `Untitled`); status chip: Uploading 43% / Ready /
   Failed — headline (tap ⓘ for detail) / Saved ✓; "Details" opens the
   existing per-card dialog (kept, for the rare override); ✕ remove.
6. **Sticky bottom bar** (`sticky bottom-0`, safe-area padding): "Save N
   paintings" (N = ready cards; disabled while 0), muted note "Failed photos
   stay here so you can retry", and "Start over" (existing confirm).
   After save: saved cards animate out, toast "12 paintings added to
   Abstracts", failed rows from the server stay with their reason.

### Phase 3 — Survive a reload (gap 10)

Persist `{ defaults, cards: [{ id, title, uploadUrl, uploadPath, width,
height, sectionId, medium, dimensions, … }] }` for cards that are `ready`
into `localStorage` (`bulk-upload:draft:v1`) on every change; files
themselves can't persist. On mount, if a draft with ≥1 ready card exists,
show a banner "You have 5 uploaded photos that weren't saved — Continue /
Discard". Discard calls `/api/admin/delete-upload` for each path. Thumbnails
for restored cards use `uploadUrl`.

### Not in scope
Server-side HEIC conversion (the bundled `sharp` lacks libheif on Vercel) —
covered by the iOS "Most Compatible" hint instead. Background uploads after
the tab is closed (needs a service worker) — the wake lock + resume covers
the realistic case.

## Files

| File | Change |
|---|---|
| `app/api/admin/upload-url/route.ts` | new |
| `lib/storage/upload.ts` | rewrite (shrink → signed URL → XHR PUT with progress → retry) |
| `lib/image-shrink.ts` | new |
| `lib/upload-errors.ts` | new |
| `components/admin/image-upload-cropper.tsx` | `uploadBlob` → `uploadImage`; errors via `explainUploadError` |
| `components/admin/multi-image-upload.tsx` | same; stop swallowing the error |
| `app/admin/(authed)/portfolio/bulk-upload/bulk-upload-client.tsx` | phases 1–3 UI |
| `lib/actions/paintings.ts` `bulkCreatePaintings` | slug-collision retry |
| `docs/HANDOFF.md` | note the 4.5 MB limit and the signed-URL path |

## Acceptance checks
- `npm run build && npm run lint` green.
- Upload a 7 MB JPEG via bulk upload on localhost → succeeds; network tab shows a PUT to `supabase.co/storage/v1/object/upload/sign/...`, not `/api/admin/upload`.
- Turn Wi-Fi off mid-upload → card shows "No internet connection" with the detail available; turning it back on and tapping Retry failed succeeds.
- Choose a `.heic` file → friendly HEIC message, no console error.
- Save with 3 ready + 1 failed → 3 saved (AR models appear within a minute), the failed one remains with its reason.
- Reload mid-batch → "Continue" banner restores the uploaded cards.
- On a 375 px viewport nothing overflows horizontally; the save bar stays visible above the iOS home indicator.
