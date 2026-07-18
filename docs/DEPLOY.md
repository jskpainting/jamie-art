# DEPLOY & ADMIN GUIDE

Plain-English guide to putting this site live and managing who can log in.
No prior knowledge assumed.

---

## The big picture (what runs where)

- **The website code** lives on GitHub: `github.com/jskpainting/jamie-art`.
- **The database + all painting images** already live in **Supabase** (the cloud).
  Nothing important runs on anyone's personal computer.
- **The live website** should run on **Vercel** — Vercel pulls the code from
  GitHub and hosts it on the internet. Every time code is pushed to GitHub,
  Vercel rebuilds the site automatically.

So the flow is: **GitHub (code) → Vercel (hosting) → your domain**, with
**Supabase** holding the data behind it.

Handing this off to someone else = give them access to the GitHub repo, the
Vercel project, and the Supabase project. They can then pull the repo into
Claude Code on their own computer and edit the site.

---

## How admin login works (magic link)

There are **no passwords**. To get into `/admin`:

1. Go to `/admin` → you're sent to the sign-in page.
2. Type your email → click "Send magic link".
3. Supabase emails you a link → click it → you land in the admin panel.

**Who gets in is controlled in two matching places** (both one-time setup):
1. The `ADMIN_EMAILS` setting — the app's allowlist (blocks everyone else from
   the admin screens).
2. The **Users list in Supabase** — because signups are turned off, only
   accounts you create by hand can log in at all (this protects the database
   itself, not just the screens).

Put the **same two emails** in both. That's your two admins.

---

## STEP 1 — Supabase settings (5 minutes, one time)

Log in at supabase.com, open this project.

1. **Authentication → URL Configuration**
   - **Site URL:** `https://jamiekendrioski.com` (the real public URL).
   - **Redirect URLs:** add BOTH of these (one per line):
     - `https://jamiekendrioski.com/auth/callback`
     - `http://localhost:7847/auth/callback`  ← lets local development log in too
   - Save. *(This is the #1 reason magic links "bounce back to login" — if the
     redirect URL isn't listed here, Supabase refuses it.)*

2. **Authentication → Email Templates → "Magic Link"**
   Set the link in the template to this exact line (makes links work when opened
   on a different device, e.g. you request on your laptop but click on your phone):
   ```
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/admin">Log in</a>
   ```
   Save.

3. **Authentication → Sign In / Providers → turn OFF "Allow new users to sign
   up". THIS IS REQUIRED, not optional.** ⚠️
   Here's why it matters: the database trusts *any* logged-in Supabase user.
   If signups are ON, a stranger could create their own account and then read
   your data (subscriber emails, inquiries) or damage it — going around the
   website entirely. With signups OFF, the only accounts that can ever exist
   are the ones you create by hand in the next step, so "logged in" = "you".

4. **Authentication → Users → "Add user" → create ONE user for each admin
   email** (use "Auto Confirm User"). Because signups are off, an admin can only
   log in if their account already exists here. Create exactly the same two
   emails you'll put in `ADMIN_EMAILS`.

---

## STEP 2 — Deploy to Vercel (10 minutes, one time)

1. Go to vercel.com, sign in **with GitHub**.
2. **Add New → Project → Import** `jskpainting/jamie-art`.
3. Before clicking Deploy, open **Environment Variables** and add these
   (copy the Supabase/Resend values from your local `.env.local` file, EXCEPT
   set the ones marked below to their production values):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | (from `.env.local`) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (from `.env.local`) |
   | `SUPABASE_SECRET_KEY` | (from `.env.local`) |
   | `RESEND_API_KEY` | (from `.env.local`) |
   | `RESEND_FROM_EMAIL` | `hello@jamiekendrioski.com` (must be a domain verified in Resend) |
   | `NEXT_PUBLIC_SITE_URL` | `https://jamiekendrioski.com` |
   | `ADMIN_EMAILS` | `you@email.com,second@email.com`  ← **the two admins** |
   | `ADMIN_AUTH_BYPASS` | `false`  ← **must be false in production** |

4. Click **Deploy**. Wait for it to finish. You'll get a temporary
   `something.vercel.app` URL — test admin login there first (see STEP 4).

**⚠️ Never set `ADMIN_AUTH_BYPASS=true` on Vercel** — that turns admin security
completely off. It's only for local development.

---

## STEP 3 — Connect your domain (when ready to go live)

The domain `jamiekendrioski.com` currently points at the old Weebly/Square site.
When you're ready to switch:

1. In Vercel: **Project → Settings → Domains → Add** `jamiekendrioski.com`
   (and `www.jamiekendrioski.com`).
2. Vercel shows you DNS records to set. Add them at wherever the domain is
   registered (GoDaddy/Squarespace/etc.). This is the step that moves the public
   site off Weebly and onto this new one.
3. Also update the Supabase **Site URL / Redirect URLs** (STEP 1) if the final
   URL differs.

---

## STEP 4 — Test the login (do this after every setup change)

1. Open the site's `/admin` in a private/incognito window.
2. Enter an email **that is on the `ADMIN_EMAILS` list** → send link → click it.
   → You should land in the admin panel. ✅
3. Try an email **NOT** on the list → you'll see "This email isn't authorized".
   ✅ That's the security working.
4. Try a **brand-new email that has no Supabase user** → no link should arrive
   (signups are off). ✅ Strangers can't self-register.

---

## Managing admins later

To **add** an admin: (1) create their user in **Supabase → Authentication →
Users → Add user**, and (2) add their email to `ADMIN_EMAILS` in **Vercel →
Settings → Environment Variables**, then **redeploy** (Vercel → Deployments →
⋯ → Redeploy). Both steps are needed.

To **remove** an admin: delete them from the Supabase Users list AND remove them
from `ADMIN_EMAILS`, then redeploy.

---

## Optional: maximum database hardening (advanced)

The steps above are secure. If you want belt-and-suspenders — so the database is
locked to specific emails even if signups ever got turned back on by accident —
paste this into **Supabase → SQL Editor → New query**, replacing the two emails,
and click **Run**. (Safe to skip; the setup above already protects you.)

```sql
-- Restrict all admin data access to specific emails, not just "any logged-in user".
create or replace function public.is_admin() returns boolean
  language sql stable as $$
    select lower(coalesce(auth.jwt() ->> 'email','')) in (
      'you@email.com', 'second@email.com'   -- <-- your two admin emails, lowercase
    );
  $$;

-- Repeat for each sensitive table you want locked down:
drop policy if exists "auth all contacts"   on contacts;
create policy "admin all contacts"   on contacts   for all using (public.is_admin());
drop policy if exists "auth read commission_inquiries" on commission_inquiries;
create policy "admin read commission_inquiries" on commission_inquiries for select using (public.is_admin());
drop policy if exists "auth all inquiries"  on inquiries;
create policy "admin all inquiries"  on inquiries  for all using (public.is_admin());
```

---

## For a developer taking this over

```bash
git clone https://github.com/jskpainting/jamie-art.git
cd jamie-art
cp .env.local.example .env.local   # then fill in the real values
npm install
npm run dev                        # http://localhost:7847
```

Local dev uses `ADMIN_AUTH_BYPASS=true` so admin is open without login on your
machine. See `CLAUDE.md` and `docs/BUILD_SPEC.md` for architecture.
