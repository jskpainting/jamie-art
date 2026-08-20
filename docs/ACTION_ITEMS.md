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

## Done

- 2026-08-20 — Deleted the five leftover QA contacts (`test+newsletter@`,
  `qa-test@`, `ratelimit-test@`, `verify-newcode@`, `www-verify@`, all
  `@example.com`). Two real contacts remain. Live painting counts re-verified
  unchanged (51/14/8/12 = 85).
