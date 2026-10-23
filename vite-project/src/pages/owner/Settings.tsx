import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MdAutorenew,
  MdContentCopy,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'

type StaffRole = 'branch_manager' | 'sales'

type Branch = { id: string; name: string }

type Account = {
  id: string
  full_name: string
  role: StaffRole
  branch_id: string
  email: string | null
  password: string | null
}

const STAFF_ROLES: { role: StaffRole; label: string }[] = [
  { role: 'branch_manager', label: 'مدير الفرع' },
  { role: 'sales', label: 'السيلز' },
]

const BRANCH_ORDER = ['الفرع الأول', 'الفرع الثاني', 'الفرع الثالث']

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const iconBtnClass =
  'rounded-md p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100'

const primaryBtnClass =
  'rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'rounded-lg border border-ink-700 px-4 py-2.5 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800'

// ---------- helpers ----------

async function callManageUser(body: Record<string, unknown>) {
const { data, error } = await supabase.functions.invoke('rapid-responder', {    body,
  })

  if (error) {
    let message = 'حصل خطأ، حاول تاني'
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.json()
        if (parsed?.error) message = parsed.error
      } catch {
        // نسيب الرسالة الافتراضية
      }
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)
  return data
}

function generatePassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function fetchAccounts() {
  const [branchesRes, profilesRes] = await Promise.all([
    supabase.from('branches').select('id, name'),
    supabase
      .from('profiles')
      .select(
        'id, full_name, role, branch_id, user_credentials(email, password_plain)'
      )
      .in('role', ['branch_manager', 'sales']),
  ])

  if (branchesRes.error) throw branchesRes.error
  if (profilesRes.error) throw profilesRes.error

  const branches = ([...(branchesRes.data ?? [])] as Branch[]).sort((a, b) => {
    const ia = BRANCH_ORDER.indexOf(a.name)
    const ib = BRANCH_ORDER.indexOf(b.name)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const accounts: Account[] = (profilesRes.data ?? []).map((row) => {
    const raw = row.user_credentials as unknown
    const cred = (Array.isArray(raw) ? raw[0] : raw) as
      | { email: string | null; password_plain: string | null }
      | null
      | undefined

    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role as StaffRole,
      branch_id: row.branch_id as string,
      email: cred?.email ?? null,
      password: cred?.password_plain ?? null,
    }
  })

  return { branches, accounts }
}

// ---------- password input ----------

function PasswordInput({
  value,
  onChange,
  placeholder = 'الباسورد',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-20 text-left`}
      />
      <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        <button
          type="button"
          title="توليد باسورد"
          aria-label="توليد باسورد"
          className={iconBtnClass}
          onClick={() => {
            onChange(generatePassword())
            setShow(true)
          }}
        >
          <MdAutorenew size={20} />
        </button>
        <button
          type="button"
          aria-label={show ? 'إخفاء الباسورد' : 'إظهار الباسورد'}
          className={iconBtnClass}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
        </button>
      </div>
    </div>
  )
}

// ---------- change password ----------

function ChangePasswordForm({
  userId,
  onDone,
}: {
  userId: string
  onDone?: () => void
}) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      callManageUser({ action: 'set-password', user_id: userId, password }),
    onSuccess: () => {
      toast.success('تم تغيير الباسورد')
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onDone?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('الباسورد لازم يكون 6 حروف على الأقل')
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PasswordInput
        value={password}
        onChange={setPassword}
        placeholder="الباسورد الجديد"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className={primaryBtnClass}>
          {mutation.isPending ? 'جاري الحفظ...' : 'حفظ الباسورد'}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className={ghostBtnClass}>
            إلغاء
          </button>
        )}
      </div>
    </form>
  )
}

// ---------- create account ----------

function CreateAccountForm({
  branch,
  role,
}: {
  branch: Branch
  role: StaffRole
}) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      callManageUser({
        action: 'create',
        full_name: fullName,
        email,
        password,
        role,
        branch_id: branch.id,
      }),
    onSuccess: () => {
      toast.success('تم إنشاء الحساب')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      toast.error('اكتب الاسم والإيميل')
      return
    }
    if (password.length < 6) {
      toast.error('الباسورد لازم يكون 6 حروف على الأقل')
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="الاسم"
        className={inputClass}
      />
      <input
        type="email"
        dir="ltr"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="الإيميل (مش لازم يكون حقيقي)"
        className={`${inputClass} text-left`}
      />
      <PasswordInput value={password} onChange={setPassword} />
      <button type="submit" disabled={mutation.isPending} className={`${primaryBtnClass} w-full`}>
        {mutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
      </button>
    </form>
  )
}

// ---------- account card ----------

function AccountCard({
  branch,
  role,
  label,
  account,
}: {
  branch: Branch
  role: StaffRole
  label: string
  account: Account | undefined
}) {
  const [changing, setChanging] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function copyPassword() {
    if (!account?.password) return
    try {
      await navigator.clipboard.writeText(account.password)
      toast.success('تم نسخ الباسورد')
    } catch {
      toast.error('مقدرتش أنسخ، انسخه يدوي')
    }
  }

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-bold">{label}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            account
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-ink-800 text-ink-400'
          }`}
        >
          {account ? 'مفعّل' : 'لسه مفيش حساب'}
        </span>
      </div>

      {account ? (
        <div className="space-y-4">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-400">الاسم</dt>
              <dd className="truncate font-semibold">{account.full_name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-400">الإيميل</dt>
              <dd dir="ltr" className="truncate font-semibold">
                {account.email ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-400">الباسورد</dt>
              <dd className="flex items-center gap-1">
                <span dir="ltr" className="font-mono font-semibold">
                  {showPassword ? account.password ?? '—' : '••••••••'}
                </span>
                <button
                  type="button"
                  aria-label={showPassword ? 'إخفاء الباسورد' : 'إظهار الباسورد'}
                  className={iconBtnClass}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <MdVisibilityOff size={20} />
                  ) : (
                    <MdVisibility size={20} />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="نسخ الباسورد"
                  className={iconBtnClass}
                  onClick={copyPassword}
                >
                  <MdContentCopy size={18} />
                </button>
              </dd>
            </div>
          </dl>

          {changing ? (
            <ChangePasswordForm
              userId={account.id}
              onDone={() => setChanging(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setChanging(true)}
              className={ghostBtnClass}
            >
              تغيير الباسورد
            </button>
          )}
        </div>
      ) : (
        <CreateAccountForm branch={branch} role={role} />
      )}
    </div>
  )
}

// ---------- page ----------

export default function Settings() {
  const { profile } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">الإعدادات</h1>
        <p className="mt-2 text-ink-400">
          حساب مدير الفرع وحساب السيلز لكل فرع، وتغيير الباسوردات.
        </p>
      </section>

      {profile && (
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-1 font-bold">باسورد المناجر (حسابك)</h2>
          <p className="mb-4 text-sm text-ink-400">{profile.full_name}</p>
          <div className="max-w-md">
            <ChangePasswordForm userId={profile.id} />
          </div>
        </section>
      )}

      {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

      {error && (
        <p className="rounded-lg border border-brand-700 bg-brand-900/40 p-4 text-sm text-brand-100">
          مقدرتش أحمّل الحسابات. اتأكد إنك شغّلت ملفات الـ SQL وإنك داخل بحساب
          المناجر.
        </p>
      )}

      {data?.branches.map((branch) => (
        <section key={branch.id} className="space-y-4">
          <h2 className="text-xl font-bold">{branch.name}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {STAFF_ROLES.map(({ role, label }) => (
              <AccountCard
                key={role}
                branch={branch}
                role={role}
                label={label}
                account={data.accounts.find(
                  (a) => a.branch_id === branch.id && a.role === role
                )}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
