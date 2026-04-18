import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookieStore).getAll(),
        setAll: async (cookiesToSet) => {
          try {
            const store = await cookieStore
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // setAll can fail in Server Components (read-only cookies)
            // This is expected — middleware handles the write path
          }
        },
      },
    }
  )
}