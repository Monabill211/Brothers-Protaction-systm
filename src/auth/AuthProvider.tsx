import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './auth-context'
import { ROLE_HOME, type Role } from './roles'

// وضع التجربة (للتطوير بس): VITE_DEV_ROLE=owner في ملف .env بيفتح لوحة الدور ده
// من غير تسجيل دخول. import.meta.env.DEV بتبقى false في نسخة الإنتاج (build)،
// فالكود ده مش بيشتغل هناك.
const devRole = import.meta.env.VITE_DEV_ROLE as Role | undefined
const DEV_ROLE: Role | undefined =
  import.meta.env.DEV && devRole && ROLE_HOME[devRole] ? devRole : undefined

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  // id of the user whose profile we finished loading (success or fail)
  const [profileFor, setProfileFor] = useState<string | null>(null)

  // 1) Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    // لا تنادي supabase جوه الـ callback ده (بيعمل deadlock)، بس حدّث الـ state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  // 2) Profile (role + branch) whenever the user changes
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileFor(null)
      return
    }

    let cancelled = false

    supabase
      .from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return

        if (data) {
          setProfile(data as Profile)
        } else {
          setProfile(null)
          // يوزر موجود في Auth ومش متسجل في profiles -> اطلّعه
          if (error?.code === 'PGRST116') {
            void supabase.auth.signOut()
          }
        }
        setProfileFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const loading = sessionLoading || (userId !== undefined && profileFor !== userId)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (DEV_ROLE) {
    const devValue = {
      session: {} as Session,
      profile: {
        id: 'dev-user',
        full_name: 'وضع التجربة',
        role: DEV_ROLE,
        branch_id: null,
      },
      loading: false,
      signOut: async () => {},
    }
    return (
      <AuthContext.Provider value={devValue}>{children}</AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
