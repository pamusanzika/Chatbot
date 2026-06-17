import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'

function makeCookieMethods(cookieStore: Awaited<ReturnType<typeof cookies>>): CookieMethodsServer {
  return {
    getAll() { return cookieStore.getAll() },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {}
    },
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: makeCookieMethods(cookieStore) }
  )
}

/** Service-role client — server only, bypasses RLS. Use only in trusted server code. */
export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: makeCookieMethods(cookieStore) }
  )
}
