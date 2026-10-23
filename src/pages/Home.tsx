import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { ROLE_HOME } from '../auth/roles'
import { centerX, pad } from '../lib/spacing'
import { NAV, ROLE_LABEL } from '../components/layout/nav'

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return null

  // كل مهام الدور ما عدا الرئيسية نفسها
  const cards = NAV[profile.role].filter(
    (item) => item.to !== ROLE_HOME[profile.role]
  )

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 32 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">
          مرحباً بك في لوحة تحكم <span className="text-brand-500">Brothers</span>
        </h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          أهلاً {profile.full_name}، دخلت بصلاحية {ROLE_LABEL[profile.role]}
        </p>
      </section>

      <section
        className="grid sm:grid-cols-2 xl:grid-cols-3"
        style={{ gap: 16 }}
      >
        {cards.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-start rounded-2xl border border-ink-700 bg-ink-900 transition hover:border-brand-600 hover:bg-ink-800"
              style={{ ...pad(20), gap: 16 }}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-600/15 text-brand-500">
                <Icon size={26} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{item.label}</span>
                <span
                  className="block text-sm text-ink-400"
                  style={{ marginTop: 4 }}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
