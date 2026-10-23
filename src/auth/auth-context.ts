import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Role } from './roles'

export type Profile = {
  id: string
  full_name: string
  role: Role
  branch_id: string | null
}

export type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
