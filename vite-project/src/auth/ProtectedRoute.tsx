import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth-context'
import { ROLE_HOME, type Role } from './roles'

export default function ProtectedRoute({ allow }: { allow: Role[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        جاري التحميل...
      </main>
    )
  }

  // مش مسجل دخول
  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  // مسجل بس دوره مش مسموح له بالصفحة دي -> يروح صفحته هو
  if (!allow.includes(profile.role)) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <Outlet />
}
