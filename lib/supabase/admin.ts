// NEVER import this file from a client component or any code reachable
// from the browser. SUPABASE_SECRET_KEY bypasses RLS. Server routes
// and Server Actions only.
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
