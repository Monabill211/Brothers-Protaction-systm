import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { MdClose, MdLogout, MdMenu } from 'react-icons/md'
import { useAuth } from '../../auth/auth-context'
import { ROLE_HOME } from '../../auth/roles'
import { NAV, ROLE_LABEL } from './nav'

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  // قفل السكرول لما القايمة مفتوحة على الموبيل + Escape يقفلها
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!profile) return null

  const items = NAV[profile.role]
  const home = ROLE_HOME[profile.role]

  return (
    <div className="min-h-screen lg:flex">
      {/* خلفية معتمة ورا القايمة (موبيل بس) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      {/* القايمة الجانبية: درج على الموبيل، ثابتة على الشاشات الكبيرة */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-ink-700 bg-ink-900 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-ink-700 p-4">
          <img
            src="/logo-badge.png"
            alt="Brothers Car Protection"
            width={48}
            height={48}
            className="h-12 w-12"
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">Brothers</p>
            <p className="text-xs text-ink-400">{ROLE_LABEL[profile.role]}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 lg:hidden"
          >
            <MdClose size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === home}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-ink-100 hover:bg-ink-800'
                  }`
                }
              >
                <Icon size={22} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-ink-700 p-3">
          <p className="truncate px-3 pb-2 text-sm text-ink-400">
            {profile.full_name}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-ink-100 transition hover:bg-ink-800"
          >
            <MdLogout size={22} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-700 bg-ink-950/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={open}
            className="rounded-lg p-2 text-ink-100 transition hover:bg-ink-800 lg:hidden"
          >
            <MdMenu size={26} />
          </button>

          <img
            src="/logo-wordmark.webp"
            alt="Brothers"
            className="h-7 w-auto"
          />

          <p className="ms-auto hidden text-sm text-ink-400 sm:block">
            {profile.full_name}
          </p>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
