// One-time CLI fallback for setting an admin's password directly, for the
// case where the owner is locked out of email entirely (magic-link rate
// limited) and can't get into /admin/account to set one himself.
//
// Refuses to run for any email that isn't on the ADMIN_EMAILS allowlist —
// this script must never be able to grant access beyond what's already
// allowed, it only gives an allowlisted admin a second way to authenticate.
//
// Usage:
//   node scripts/set-admin-password.mjs <email>              (prompts for password, hidden input)
//   node scripts/set-admin-password.mjs <email> <password>   (not recommended — ends up in shell history)
//
// The password is never logged or printed back.

import { readFileSync } from "node:fs"
import { createInterface } from "node:readline"

// --- tiny .env.local loader (same style as scripts/generate-ar-model.mjs) ---
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAILS = (env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

if (!SUPA || !KEY) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local. Can't talk to Supabase."
  )
}

const email = (process.argv[2] || "").trim().toLowerCase()
if (!email) {
  fail("Usage: node scripts/set-admin-password.mjs <email> [password]")
}

if (!ADMIN_EMAILS.includes(email)) {
  fail(
    `"${email}" is not in ADMIN_EMAILS (.env.local). Refusing to set a password for a non-admin account.\n  Allowlisted: ${ADMIN_EMAILS.join(", ") || "(none configured)"}`
  )
}

// Control-character constants, expressed as char codes so the source file
// never contains raw unprintable bytes.
const CODE_LF = 10 // \n
const CODE_CR = 13 // \r
const CODE_EOT = 4 // Ctrl-D
const CODE_ETX = 3 // Ctrl-C
const CODE_BACKSPACE = 8
const CODE_DEL = 127

/** Read a password from argv, or prompt for it with input hidden (no echo). */
async function readPassword() {
  if (process.argv[3]) {
    console.warn(
      "⚠️  Password passed as an argument — it may end up in your shell history. Prefer the interactive prompt."
    )
    return process.argv[3]
  }

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const stdin = process.stdin
    process.stdout.write("New password (input hidden): ")
    let value = ""
    const onData = (chunk) => {
      const code = chunk[0]
      if (code === CODE_LF || code === CODE_CR || code === CODE_EOT) {
        stdin.setRawMode?.(false)
        stdin.off("data", onData)
        process.stdout.write("\n")
        rl.close()
        resolve(value)
        return
      }
      if (code === CODE_ETX) {
        process.stdout.write("\n")
        process.exit(1)
      }
      if (code === CODE_BACKSPACE || code === CODE_DEL) {
        value = value.slice(0, -1)
        return
      }
      value += chunk.toString("utf8")
    }
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.on("data", onData)
  })
}

async function main() {
  const password = await readPassword()

  if (!password || password.length < 10) {
    fail("Password must be at least 10 characters.")
  }

  console.log(`\nLooking up "${email}" in Supabase Auth…`)

  // The Admin API has no "get user by email" endpoint — page through users
  // and match. Admin user lists are small (this project has 3 total users),
  // so a single page is enough in practice, but we page defensively anyway.
  let userId = null
  let page = 1
  const perPage = 200
  while (!userId) {
    const res = await fetch(
      `${SUPA}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    )
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      fail(`Supabase Admin API error (${res.status}) listing users: ${body}`)
    }
    const data = await res.json()
    const users = data.users ?? []
    const match = users.find((u) => (u.email || "").toLowerCase() === email)
    if (match) {
      userId = match.id
      break
    }
    if (users.length < perPage) break // no more pages
    page += 1
  }

  if (!userId) {
    fail(
      `No Supabase Auth user found for "${email}". This script only sets a password for an existing user — it cannot create one (signups are disabled project-wide).`
    )
  }

  console.log(`Found user ${userId}. Setting password…`)

  const putRes = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  })

  if (!putRes.ok) {
    const body = await putRes.text().catch(() => "")
    fail(`Supabase Admin API error (${putRes.status}) setting password: ${body}`)
  }

  console.log(
    `\n✓ Password set for ${email}. They can now sign in at /admin/login using "Sign in with a password instead".\n`
  )
}

main().catch((err) => {
  fail(err?.message || String(err))
})
