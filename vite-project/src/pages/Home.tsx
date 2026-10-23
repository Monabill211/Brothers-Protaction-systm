import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { ROLE_HOME } from '../auth/roles'
import { NAV, ROLE_LABEL } from '../components/layout/nav'

export default function Home() {
  const { profile } = useAuth()
  if (!profile) return null

  // كل مهام الدور ما عدا الرئيسية نفسها
  const cards = NAV[profile.role].filter(
    (item) => item.to !== ROLE_HOME[profile.role]
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">
          مرحباً بك في لوحة تحكم <span className="text-brand-500">Brothers</span>
        </h1>
        <p className="mt-2 text-ink-400">
          أهلاً {profile.full_name}، دخلت بصلاحية {ROLE_LABEL[profile.role]}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-start gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-5 transition hover:border-brand-600 hover:bg-ink-800"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-600/15 text-brand-500">
                <Icon size={26} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{item.label}</span>
                <span className="mt-1 block text-sm text-ink-400">
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
