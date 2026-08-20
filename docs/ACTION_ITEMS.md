# Action items for Jamie

Things only the owner can do. Claude adds to this list instead of blocking.
Last updated: 2026-08-20

## Open

### 1. Measure three paintings (AR "View on my wall")
`globe-2`, `cityscape`, and one `untitled` have no usable dimensions, so the
AR button never appears for them. Measure height x width in inches and tell
Claude. **Do not guess** — a wrongly scaled true-scale model is worse than
none, so no placeholder is used here.

### 2. Verify the sending domain with Resend
`jamiekendrioski.com` is registered in Resend but its status is **failed** —
all three required DNS records are missing (confirmed against live DNS).
DNS is hosted at **Register.com**. Add:

| Type | Name / Host | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDK34eaJnFCeipafDLr9ezIwjAzLiNOsFuta07IdyX5lI7R5Qp+i417PBWJWyrRE2dfqilFdgx/6u+4WE9/jX4B3VMbH1MmLbG0aaSBz7CyiMECq/G1eUwvOaAU3m3MyNs4e35kt55aE3ktHAHDa+djdRLCnH1aKoMZ25F0ldjQwwIDAQAB` | - |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | - |

Then Resend -> Domains -> Verify.

### 3. Set RESEND_FROM_EMAIL in Vercel (after step 2 verifies)
Vercel -> jamie-art -> Settings -> Environment Variables -> Add New.
Key `RESEND_FROM_EMAIL`, value e.g. `Jamie Kendrioski <hello@jamiekendrioski.com>`,
tick Production + Preview + Development, Save, then **Redeploy** the latest
deployment (Vercel does not apply new variables until a redeploy).
Until this is set, the Send button correctly refuses and reports that nothing
went out.

### 4. Test on a real device (only the owner can)
- AR "View on my wall" on a real phone.
- The "Send as a text" button on a real device.
Claude must never claim these are verified.

### 5. Decide what to do with leftover test / spam enquiries
The dashboard now correctly counts commission enquiries, and that count
includes some junk. Claude did not delete any of these — say the word.

`inquiries`:
- "Test User" <test+claude@example.com> (status new) — test data
- "basu" <jsdjs@gmail.com> (status new) — is this real?

`commission_inquiries`:
- "Test User" <test+claude@example.com> (new) — test data
- "HeENkMFOpUUarqGzlqlGV" <iv.u.s.u.q.en.0.8.1@gmail.com> (new) — spam
- "Test jamie" <jsk0078@gmail.com> (new) — your own test

Deleting the three obvious ones would take the dashboard from 5 new to 2.

### 6. Optional: enforce one-row-only in the database
`settings` and `bio` are meant to hold exactly one row and nothing in the
database enforces it. The code no longer creates or trips over a duplicate,
so this is defence in depth only, not a fix that is needed. Say so if you
want the SQL and Claude will write it for you to paste into Supabase.


## Done

- 2026-08-20 — Deleted the five leftover QA contacts (`test+newsletter@`,
  `qa-test@`, `ratelimit-test@`, `verify-newcode@`, `www-verify@`, all
  `@example.com`). Two real contacts remain. Live painting counts re-verified
  unchanged (51/14/8/12 = 85).
- 2026-08-20 — Backfilled the one painting with no pixel dimensions
  ("Untitled 69", measured 2484 x 2457 from its stored photo). All 85
  paintings now have true dimensions, so no gallery card is guessed at 4:3.
