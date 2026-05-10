import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Async because Next.js 16 made `cookies()` async. All callers must `await`.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // setAll can fail in Server Components (read-only cookies).
            // Middleware handles the write path; silent skip is expected.
          }
        },
      },
    }
  )
}
