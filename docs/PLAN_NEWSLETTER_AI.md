# Plan — "Write my newsletter for me" + a nicer editor

Owner's ask (13 Sep 2026): on the Newsletters page, either type the email by
hand or type a one-line request ("announce the three new fall pieces and the
October show") and have the AI draft it; a friendlier editor with formatting;
as few clicks as possible. Keys come later (Gemini/Groq — see
`docs/AI_SETUP.md`); until then the button explains what's needed.

## Existing pieces
- `lib/ai/router.ts` + `lib/ai/providers.ts` — free multi-provider text
  router (Groq, Gemini, Cerebras, Mistral, OpenRouter, NVIDIA), `aiConfigured()`.
- `lib/actions/ai.ts` — `generatePaintingStory` (pattern: Zod input, rate
  limit, system prompt, post-processing).
- `app/admin/(authed)/newsletters/newsletters-client.tsx` — subject + markdown
  body (`MarkdownEditor`: Write/Preview tabs), live email preview, confirm,
  past sends. `lib/actions/newsletters.ts` `sendNewsletter`.
- `lib/email/templates.ts` — markdown → table-based HTML email via `marked`.

## Deliverables

### 1. `lib/actions/ai.ts` — `generateNewsletter(input)`
Input (Zod): `request` (1–1000 chars), `includeNewPaintings` (bool, default
true), `includeEvents` (bool, default true), `tone` ("warm" | "short" |
"playful", default warm). Server builds context (admin client, no DB writes):
- Artist: "Jamie Kendrioski", site `SITE_URL`, Instagram handle from settings.
- Newest 6 paintings (created_at desc) with title, caption (`story`), status,
  public URL and `primary_image_url`.
- Current + upcoming events (title, date range via existing formatter,
  location, link).
System prompt: write a short artist newsletter in Markdown for existing fans;
subject line first as `Subject: …`; 120–250 words; warm, first person, no
hype clichés; only facts from the context; when a painting is included write
it as `![Title](image_url)` followed by `**Title** — caption` and a link
`[See it](url)`; end with one gentle call to action; no signature block (the
template adds it). Output parsing: first `Subject:` line → subject; rest →
body. Rate limit like the story action. Returns `{ ok, subject, body, attempts }`
or `{ ok:false, error }` with the friendly "needs a key" message when
`!aiConfigured()`.

### 2. Newsletter page UI
Above the editor, a card **"Write it for me"**: a textarea "What should this
email say?" (placeholder with two examples), two checkboxes (Include my newest
paintings with photos · Include upcoming shows), a tone segmented control, and
a **Generate** button. Result fills Subject + Body directly (if the body is
non-empty, ask once via ConfirmDialog "Replace what you've written?"). Small
"Try again" link re-runs with the same request. When AI isn't configured the
card shows one sentence: "To use this, add a free Gemini or Groq key — see the
setup note in the project (docs/AI_SETUP.md)." — no jargon beyond that.

### 3. Editor upgrade (`components/admin/markdown-editor.tsx`)
Add an optional toolbar (prop `toolbar?: boolean`, on for newsletters): Bold,
Italic, Heading, Link, Bullet list, Quote, and **Insert painting** (opens the
existing `PaintingPicker`/`getAllPaintingsForPicker` list; inserts the
image + bold title + caption + link block above). Toolbar buttons wrap the
selection in the textarea (keep `selectionStart/End`), plain markdown under
the hood, Preview tab unchanged. Mobile: toolbar scrolls horizontally.

### 4. Fewer clicks
- Subject auto-suggested from the first heading if left blank.
- "Send a test to me" button (sends only to the signed-in admin email via the
  existing Resend path) before the real send.
- Keep the confirm step for the real send.

## Verify
tsc + lint; `/admin/newsletters` 200 containing "Write it for me"; with no
key set the card shows the setup sentence; the Insert painting block renders
an `<img>` in the email preview.
