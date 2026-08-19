# AI story writer — setup

This adds a "Write it for me" button to a painting's Story field in the admin.
You type rough notes — words, feelings, a phrase — and it turns them into a
short 1–3 sentence description you can use as the painting's Story, or edit
by hand.

**It costs nothing.** It only uses free AI providers that don't require a
credit card. If no key is set, the button explains that and nothing breaks —
the rest of the site works exactly as before.

You only need to set up **one** of the providers below to turn it on. Groq is
the easiest and fastest. Gemini is a good free backup. The others (Cerebras,
Mistral, OpenRouter, NVIDIA) are optional extra backups — skip them unless you
want extra redundancy.

If you set up more than one, the site automatically tries the next one if the
first is temporarily busy or rate-limited, so the button just keeps working.

---

## Option 1: Groq (recommended — fast and free)

1. Go to **console.groq.com** and sign up (email or Google sign-in — no credit
   card asked for).
2. Once you're in, look for **API Keys** in the left sidebar.
3. Click **Create API Key**, give it any name (e.g. "jamie-art"), and copy the
   key it shows you. It starts with `gsk_...`. You won't be able to see it
   again after you close that dialog, so copy it now.
4. Paste it in as described below (**Where to paste it**).

## Option 2: Google Gemini (good free backup)

1. Go to **aistudio.google.com** and sign in with a Google account.
2. Click **Get API key** (usually top-left or in the sidebar).
3. Click **Create API key**, choose "Create API key in new project" if asked.
4. Copy the key it gives you. It starts with `AIza...`.
5. Paste it in as described below.

## Optional extra backups

These are entirely optional — only set them up if you want more fallback
providers in case Groq and Gemini are both temporarily unavailable:

- **Cerebras** — cerebras.ai, free API key from their console.
- **Mistral** — console.mistral.ai, free tier on signup.
- **OpenRouter** — openrouter.ai, free ":free" models, no credit card.
- **NVIDIA** — build.nvidia.com, free tier API key.

Each works the same way — copy the key and paste it in the same place as
Groq/Gemini below, just under its own name.

---

## Where to paste it

**Locally (on the Mac you're working on):**

Open the `.env.local` file in the project folder (`/Users/bb/code/jamie-art`)
in any text editor. Add a line like:

```
GROQ_API_KEY=gsk_your_key_here
```

or

```
GEMINI_API_KEY=AIza_your_key_here
```

Save the file and restart the dev server (`npm run dev`) so it picks up the
new value.

**In production (the live site, on Vercel):**

1. Go to **vercel.com**, open the jamie-art project.
2. Go to **Settings → Environment Variables**.
3. Add a new variable: Name = `GROQ_API_KEY` (or `GEMINI_API_KEY`, etc.),
   Value = the key you copied. Leave it set for "Production".
4. Save, then redeploy (or just wait for the next `git push` — either
   triggers a new deploy that picks up the new variable).

---

## That's it

Once at least one key is set (locally or in production), the "Write it for
me" button in a painting's Story section starts working. Nothing else on the
site changes, and there's nothing to turn on or configure beyond adding the
key.
