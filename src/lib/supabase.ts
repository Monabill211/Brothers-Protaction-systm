import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// لو المتغيرات ناقصة (مثلاً على Vercel من غير Environment Variables) الموقع
// بيعرض شاشة واضحة بدل صفحة فاضية. شوف main.tsx.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'missing-key'
)
