import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { ROLE_HOME, type Role } from '../auth/roles'

const schema = z.object({
  email: z.string().min(1, 'اكتب الإيميل').email('الإيميل مش مظبوط'),
  password: z.string().min(1, 'اكتب الباسورد'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

export default function Login() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    })

    if (error || !data.user) {
      toast.error('الإيميل أو الباسورد غلط')
      return
    }

    const { data: row, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const home = row ? ROLE_HOME[row.role as Role] : undefined

    if (profileError || !home) {
      await supabase.auth.signOut()
      toast.error('الحساب ده مش متسجل في السيستم، كلّم المناجر')
      return
    }

    navigate(home, { replace: true })
  }

  // لو مسجل دخول بالفعل، وديه صفحته
  if (!loading && profile) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <img
            src="/logo-badge.png"
            alt="Brothers Car Protection"
            width={112}
            height={112}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
            <p className="mt-1 text-sm text-ink-400">
              ادخل ببياناتك عشان تكمل
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-xl"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold">
              الإيميل
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="name@example.com"
              className={`${inputClass} text-left`}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-brand-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold">
              الباسورد
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${inputClass} pl-12 text-left`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء الباسورد' : 'إظهار الباسورد'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 transition hover:text-ink-100"
              >
                {showPassword ? (
                  <MdVisibilityOff size={22} />
                ) : (
                  <MdVisibility size={22} />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-brand-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 py-3 font-bold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </main>
  )
}
