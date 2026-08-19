// Dependency-free AI provider router — ported (design only) from the sibling
// project's Python `ai_router.py`. Walks an ordered chain of FREE, no-credit-card
// text-generation providers and returns the first success.
//
// Core ideas carried over from the reference implementation:
//   - ProviderUnavailable (not configured — no API key) → silently skip.
//   - ProviderError (auth/credit/rate-limit/transient/malformed response) →
//     fail over to the next provider in the chain.
//   - Any other thrown value is wrapped into ProviderError so one bad provider
//     can never crash the whole chain.
//   - A short in-process cooldown is stamped on a failing provider so later
//     calls within the cooldown window skip it immediately instead of
//     re-paying a timeout.
//   - One generic OpenAI-compatible adapter shared by every provider that
//     speaks `/chat/completions`, plus a bespoke adapter for Gemini (different
//     wire format: `:generateContent`).
//   - `runTextEx` returns an attempt log alongside the result so failures are
//     debuggable from the caller (e.g. surfaced in a toast or server log).
//
// Never logs API key values — only provider ids/status.

import {
  PROVIDERS,
  OPENAI_COMPATIBLE_PROVIDERS,
  resolveChain,
  apiKeyFor,
  modelFor,
  type ProviderId,
} from "./providers"

export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    message: string
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

/** Not configured (no API key) — always a silent skip, never a failed "attempt". */
export class ProviderUnavailable extends ProviderError {
  constructor(provider: ProviderId, message: string) {
    super(provider, message)
    this.name = "ProviderUnavailable"
  }
}

export interface RunTextInput {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
}

export interface Attempt {
  provider: ProviderId
  status: "skipped" | "cooling_down" | "error" | "success"
  detail?: string
  ms?: number
}

export interface RunTextResult {
  text: string
  provider: ProviderId
  attempts: Attempt[]
}

const PER_PROVIDER_TIMEOUT_MS = 20_000
const COOLDOWN_MS = 2 * 60_000 // 2 minutes — short, in-process only (best-effort)

const cooldowns = new Map<ProviderId, number>() // provider -> epoch ms until which it's skipped

function isCoolingDown(id: ProviderId): boolean {
  const until = cooldowns.get(id)
  return until != null && Date.now() < until
}

function startCooldown(id: ProviderId) {
  cooldowns.set(id, Date.now() + COOLDOWN_MS)
}

function clearCooldown(id: ProviderId) {
  cooldowns.delete(id)
}

/** True if at least one provider has an API key configured. */
export function aiConfigured(): boolean {
  return resolveChain().some((id) => apiKeyFor(id) != null)
}

type AdapterFn = (input: RunTextInput, id: ProviderId) => Promise<string>

// ── One generic adapter shared by every OpenAI-compatible provider ──────────
async function callOpenAiCompatible(input: RunTextInput, id: ProviderId): Promise<string> {
  const apiKey = apiKeyFor(id)
  if (!apiKey) throw new ProviderUnavailable(id, `${PROVIDERS[id].displayName}: no API key set`)

  const model = modelFor(id)
  const baseUrl = PROVIDERS[id].baseUrl
  const messages: { role: string; content: string }[] = []
  if (input.system) messages.push({ role: "system", content: input.system })
  messages.push({ role: "user", content: input.prompt })

  let resp: Response
  try {
    resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 300,
        stream: false,
      }),
      signal: AbortSignal.timeout(PER_PROVIDER_TIMEOUT_MS),
    })
  } catch (e) {
    throw new ProviderError(id, `request failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError(id, `auth failed (http ${resp.status})`)
  }
  if (resp.status === 429) {
    throw new ProviderError(id, "rate limited (http 429)")
  }
  if (resp.status >= 500) {
    throw new ProviderError(id, `server error (http ${resp.status})`)
  }
  if (!resp.ok) {
    // Includes 402 (credit exhausted) and other 4xx — all failover-worthy.
    throw new ProviderError(id, `http ${resp.status}`)
  }

  let body: unknown
  try {
    body = await resp.json()
  } catch (e) {
    throw new ProviderError(id, `malformed JSON response: ${e instanceof Error ? e.message : String(e)}`)
  }

  const text = (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
    ?.content
  if (typeof text !== "string") {
    throw new ProviderError(id, "malformed response: no choices[0].message.content")
  }
  return text.trim()
}

// ── Bespoke adapter for Gemini — different wire format (:generateContent) ───
async function callGemini(input: RunTextInput): Promise<string> {
  const id: ProviderId = "gemini"
  const apiKey = apiKeyFor(id)
  if (!apiKey) throw new ProviderUnavailable(id, "Google Gemini: no API key set")

  const model = modelFor(id)
  const baseUrl = PROVIDERS[id].baseUrl
  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  const parts: string[] = []
  if (input.system) parts.push(input.system)
  parts.push(input.prompt)

  let resp: Response
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: parts.join("\n\n") }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.7,
          maxOutputTokens: input.maxTokens ?? 300,
        },
      }),
      signal: AbortSignal.timeout(PER_PROVIDER_TIMEOUT_MS),
    })
  } catch (e) {
    throw new ProviderError(id, `request failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError(id, `auth failed (http ${resp.status})`)
  }
  if (resp.status === 429) {
    throw new ProviderError(id, "rate limited (http 429)")
  }
  if (resp.status >= 500) {
    throw new ProviderError(id, `server error (http ${resp.status})`)
  }
  if (!resp.ok) {
    throw new ProviderError(id, `http ${resp.status}`)
  }

  let body: unknown
  try {
    body = await resp.json()
  } catch (e) {
    throw new ProviderError(id, `malformed JSON response: ${e instanceof Error ? e.message : String(e)}`)
  }

  const text = (
    body as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
  )?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== "string") {
    throw new ProviderError(id, "malformed response: no candidates[0].content.parts[0].text")
  }
  return text.trim()
}

const ADAPTERS: Record<ProviderId, AdapterFn> = {
  groq: callOpenAiCompatible,
  cerebras: callOpenAiCompatible,
  mistral: callOpenAiCompatible,
  openrouter: callOpenAiCompatible,
  nvidia: callOpenAiCompatible,
  gemini: (input) => callGemini(input),
}

// Sanity check at module load: every declared OpenAI-compatible provider must
// route through the generic adapter (keeps providers.ts and router.ts in sync).
for (const id of OPENAI_COMPATIBLE_PROVIDERS) {
  if (ADAPTERS[id] !== callOpenAiCompatible) {
    throw new Error(`lib/ai/router: provider "${id}" is not wired to the generic OpenAI-compatible adapter`)
  }
}

/**
 * Walk the provider chain in order, returning the first success plus an
 * attempt log. Throws only if EVERY provider was unavailable or failed.
 */
export async function runTextEx(input: RunTextInput): Promise<RunTextResult> {
  const chain = resolveChain()
  const attempts: Attempt[] = []

  for (const id of chain) {
    if (isCoolingDown(id)) {
      attempts.push({ provider: id, status: "cooling_down" })
      continue
    }

    const start = Date.now()
    try {
      const text = await ADAPTERS[id](input, id)
      clearCooldown(id)
      attempts.push({ provider: id, status: "success", ms: Date.now() - start })
      return { text, provider: id, attempts }
    } catch (e) {
      const ms = Date.now() - start
      if (e instanceof ProviderUnavailable) {
        attempts.push({ provider: id, status: "skipped", detail: e.message, ms })
        continue
      }
      // ProviderError (or any other thrown value, wrapped) → failover.
      const detail = e instanceof Error ? e.message : String(e)
      attempts.push({ provider: id, status: "error", detail, ms })
      startCooldown(id)
      continue
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}:${a.status}${a.detail ? ` (${a.detail})` : ""}`)
    .join(", ")
  throw new Error(
    attempts.length === 0
      ? "No AI providers configured."
      : `All AI providers unavailable or failed: ${summary}`
  )
}

/** Convenience wrapper — just the text. Throws the same as `runTextEx`. */
export async function runText(input: RunTextInput): Promise<string> {
  const { text } = await runTextEx(input)
  return text
}
