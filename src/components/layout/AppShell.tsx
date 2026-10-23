import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { MdClose, MdLogout, MdMenu } from 'react-icons/md'
import { useAuth } from '../../auth/auth-context'
import { ROLE_HOME } from '../../auth/roles'
import { pad } from '../../lib/spacing'
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
        <div
          className="flex items-center border-b border-ink-700"
          style={{ ...pad(16), gap: 12 }}
        >
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
            className="rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 lg:hidden"
            style={pad(8)}
          >
            <MdClose size={24} />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto"
          style={{ ...pad(12), gap: 4 }}
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === home}
                onClick={() => setOpen(false)}
                style={{ ...pad(12), gap: 12 }}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm font-semibold transition ${
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

        <div className="border-t border-ink-700" style={pad(12)}>
          <p
            className="truncate text-sm text-ink-400"
            style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}
          >
            {profile.full_name}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center rounded-lg text-sm font-semibold text-ink-100 transition hover:bg-ink-800"
            style={{ ...pad(12), gap: 12 }}
          >
            <MdLogout size={22} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex h-16 items-center border-b border-ink-700 bg-ink-950/80 backdrop-blur"
          style={{ paddingLeft: 16, paddingRight: 16, gap: 12 }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={open}
            className="rounded-lg text-ink-100 transition hover:bg-ink-800 lg:hidden"
            style={pad(8)}
          >
            <MdMenu size={26} />
          </button>

          <img
            src="/logo-wordmark.webp"
            alt="Brothers"
            className="h-7 w-auto"
          />

          <p
            className="hidden text-sm text-ink-400 sm:block"
            style={{ marginInlineStart: 'auto' }}
          >
            {profile.full_name}
          </p>
        </header>

        {/* بدل sm:p-6 lg:p-8: padding متجاوب بدون breakpoints */}
        <main className="flex-1" style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
