/**
 * Service-role Supabase client for server-only contexts that have no user
 * session — specifically the proactive email digest endpoint, which is invoked
 * by Apps Script with a shared secret rather than a logged-in cookie.
 *
 * NEVER import this from client code. It bypasses RLS.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return adminClient
}

/**
 * Resolve the single digest recipient's user id. Prefers an explicit
 * DIGEST_USER_ID; otherwise looks it up by DIGEST_USER_EMAIL via the auth admin
 * API. (This app is single-user by design — see docs/EMAIL_DIGESTS.md.)
 */
export async function resolveDigestUserId(): Promise<string> {
  const explicit = process.env.DIGEST_USER_ID?.trim()
  if (explicit) return explicit

  const email = process.env.DIGEST_USER_EMAIL?.trim()?.toLowerCase()
  if (!email) {
    throw new Error('Set DIGEST_USER_ID or DIGEST_USER_EMAIL to identify the digest recipient')
  }

  const admin = getSupabaseAdmin()
  // Single-user app: one page of users is plenty to find the match.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error

  const match = data.users.find((u) => u.email?.toLowerCase() === email)
  if (!match) throw new Error(`No Supabase user found for DIGEST_USER_EMAIL=${email}`)
  return match.id
}
