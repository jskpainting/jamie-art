# Action items for the owner

Things only the owner can do. Claude adds to this list instead of blocking.
A printable copy is on the owner's Desktop: "Jamie Art - Your To-Do List.pdf".
Last updated: 2026-10-06

## Open

1. **Run Round 6 SQL** (docs/RUN_THIS_SQL.md → Round 6). One person per email
   in the database. The site already behaves this way; this makes the
   database enforce it.
2. **Verify the email sending domain** — Resend status is "failed"; all three
   DNS records are missing at Register.com (values in the PDF and in the
   Resend dashboard). Then Resend → Domains → Verify.
3. **Set `RESEND_FROM_EMAIL` in Vercel** after step 2 is green, then Redeploy.
4. **Check `GEMINI_API_KEY` and add `NEXT_PUBLIC_SITE_URL`
   (https://www.jamiekendrioski.com) in Vercel**, then Redeploy.
5. **Measure two paintings** (height × width, inches — do not guess):
   "Cityscape" (Cityscapes / Seascapes) and "Untitled" (Florals). They are the
   only 2 of 110 without a "View on my wall" model.
6. **Real-phone tests** (Claude must never claim these): bulk upload; RSVP via
   the public page and via an invite link; "View on my wall"; "Send as a text";
   a photo over 5 MB in Portfolio → gallery cover and in Images → Edit photo.
7. **Quick checks of the 2026-10-06 fixes** (couldn't be tested without real
   email or real data):
   - Settings → set "Name shown on newsletter emails" → Newsletters → "Send a
     test to me" → the sender should read "Name <address>" (needs steps 2–3).
   - People → a person → add a purchase of a painting with "Also mark as sold"
     → the painting should show as sold.
8. **CAPTCHA in Supabase Auth** — ask Claude first; the login page needs a
   small change.
9. **Search Console**: submit https://www.jamiekendrioski.com/sitemap.xml.
   **Share image**: send Claude a wide (~1200 × 630) photo to replace the
   placeholder.
10. **Decide**: should the "Archives (2018–2021)" gallery (16 paintings) go
    public?

## Parked by the owner (2026-10-06)

- Content-Security-Policy header.
- Soft-404 status on /portfolio/* (visitors already see "not found").
- Show cards "Generate missing" button.
- Backlog: picture version of the text-only show card; email off the QR card;
  database one-row lock for settings/bio; server-side HEIC conversion; code
  cleanup.

## Done

- 2026-10-06 — Deleted junk: 2 test enquiries, 3 commission enquiries (test,
  bot, owner's own test) and 2 subscribers (a sales pitch and the owner's own
  gmail). Backup kept outside the repo.
- 2026-10-06 — 20 fixes shipped (see CLAUDE.md "Recent shipped phases").
- 2026-08-20 — Earlier fixes and the QA-contact cleanup.
