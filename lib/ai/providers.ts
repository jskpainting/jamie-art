// Provider registry for lib/ai/router.ts — free, no-credit-card text-generation
// providers only. Each provider is configured purely via optional env vars: if
// its API key env var is unset, the router skips it silently (no crash, no cost).
//
// NOTE: free-tier model ids drift over time as providers retire/rename models.
// If a provider starts failing with 404/model-not-found, update its
// `defaultModel` below (or set the matching `*_MODEL` env var — no code change
// needed for a quick fix).

export type ProviderId =
  | "groq"
  | "gemini"
  | "cerebras"
  | "mistral"
  | "openrouter"
  | "nvidia"

/** Providers that speak the standard OpenAI-compatible `/chat/completions` schema. */
export const OPENAI_COMPATIBLE_PROVIDERS: ProviderId[] = [
  "groq",
  "cerebras",
  "mistral",
  "openrouter",
  "nvidia",
]

export interface ProviderConfig {
  id: ProviderId
  displayName: string
  /** Env var holding the API key. Absent/empty → provider is skipped. */
  apiKeyEnv: string
  baseUrl: string
  /** Default free-tier model id, overridable via `modelEnv`. */
  defaultModel: string
  /** Env var that overrides `defaultModel` for this provider. */
  modelEnv: string
}

// ── One clearly-commented table of provider base URLs + default free models ──
// Update the `defaultModel` values here (or set the env var) when a provider
// retires a free model — this table is the single place to look.
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  groq: {
    id: "groq",
    displayName: "Groq",
    apiKeyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    // Fast, widely-available open model on Groq's free tier.
    defaultModel: "llama-3.3-70b-versatile",
    modelEnv: "GROQ_MODEL",
  },
  gemini: {
    id: "gemini",
    displayName: "Google Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    // Gemini's free-tier flash model.
    defaultModel: "gemini-2.0-flash",
    modelEnv: "GEMINI_MODEL",
  },
  cerebras: {
    id: "cerebras",
    displayName: "Cerebras",
    apiKeyEnv: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    modelEnv: "CEREBRAS_MODEL",
  },
  mistral: {
    id: "mistral",
    displayName: "Mistral",
    apiKeyEnv: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    modelEnv: "MISTRAL_MODEL",
  },
  openrouter: {
    id: "openrouter",
    displayName: "OpenRouter",
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    // A ":free" model id — OpenRouter meters these against a separate free daily cap.
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    modelEnv: "OPENROUTER_MODEL",
  },
  nvidia: {
    id: "nvidia",
    displayName: "NVIDIA",
    apiKeyEnv: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.1-8b-instruct",
    modelEnv: "NVIDIA_MODEL",
  },
}

export const DEFAULT_CHAIN: ProviderId[] = [
  "groq",
  "gemini",
  "cerebras",
  "mistral",
  "openrouter",
  "nvidia",
]

/** Resolve the ordered provider chain: `AI_PROVIDER_CHAIN` env var if set, else the default. */
export function resolveChain(): ProviderId[] {
  const raw = process.env.AI_PROVIDER_CHAIN
  if (!raw || !raw.trim()) return DEFAULT_CHAIN
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ProviderId[]
  const valid = ids.filter((id) => id in PROVIDERS)
  return valid.length > 0 ? valid : DEFAULT_CHAIN
}

export function apiKeyFor(id: ProviderId): string | undefined {
  const val = process.env[PROVIDERS[id].apiKeyEnv]
  return val && val.trim() ? val.trim() : undefined
}

export function modelFor(id: ProviderId): string {
  const cfg = PROVIDERS[id]
  const override = process.env[cfg.modelEnv]
  return override && override.trim() ? override.trim() : cfg.defaultModel
}
