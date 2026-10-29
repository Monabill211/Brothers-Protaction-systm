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
import { centerX, pad } from '../../lib/spacing'
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

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const iconBtnClass =
  'rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-ink-100'

const primaryBtnClass =
  'rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800'

const col = (gap: number) => ({ gap })

// ---------- helpers ----------

async function callManageUser(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('rapid-responder', {
    body,
  })

  if (error) {
    let message = error.message || 'حصل خطأ، حاول تاني'
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.json()
        if (parsed?.error) message = parsed.error
        else if (parsed?.message) message = `${context.status}: ${parsed.message}`
      } catch {
        message = `خطأ ${context.status} من السيرفر`
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
    supabase
      .from('branches')
      .select('id, name')
      .order('position', { ascending: true }),
    supabase
      .from('profiles')
      .select(
        'id, full_name, role, branch_id, user_credentials(email, password_plain)'
      )
      .in('role', ['branch_manager', 'sales']),
  ])

  if (branchesRes.error) throw branchesRes.error
  if (profilesRes.error) throw profilesRes.error

  const branches = (branchesRes.data ?? []) as Branch[]

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
        className={`${inputClass} text-left`}
        style={{ ...pad(12, 16), paddingLeft: 80 }}
      />
      <div
        className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center"
        style={col(2)}
      >
        <button
          type="button"
          title="توليد باسورد"
          aria-label="توليد باسورد"
          className={iconBtnClass}
          style={pad(6)}
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
          style={pad(6)}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
        </button>
      </div>
    </div>
  )
}

// ---------- edit account (name / email / password) ----------

function EditAccountForm({
  userId,
  initialName,
  initialEmail,
  isSelf = false,
  onDone,
}: {
  userId: string
  initialName: string
  initialEmail: string
  isSelf?: boolean
  onDone?: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: (changes: Record<string, string>) =>
      callManageUser({ action: 'update-account', user_id: userId, ...changes }),
    onSuccess: (_data, changes) => {
      if (isSelf && changes.full_name) {
        toast.success('تم الحفظ. الاسم الجديد هيظهر بعد تحديث الصفحة')
      } else if (isSelf && changes.email) {
        toast.success('تم الحفظ. استخدم الإيميل الجديد في الدخول الجاي')
      } else {
        toast.success('تم حفظ التعديلات')
      }
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onDone?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const changes: Record<string, string> = {}

    if (name.trim() !== initialName) {
      if (!name.trim()) {
        toast.error('اكتب الاسم')
        return
      }
      changes.full_name = name.trim()
    }

    if (email.trim().toLowerCase() !== initialEmail.toLowerCase()) {
      if (!email.trim()) {
        toast.error('اكتب الإيميل')
        return
      }
      changes.email = email.trim()
    }

    if (password) {
      if (password.length < 6) {
        toast.error('الباسورد لازم يكون 6 حروف على الأقل')
        return
      }
      changes.password = password
    }

    if (Object.keys(changes).length === 0) {
      toast.error('مفيش حاجة اتغيّرت')
      return
    }
    mutation.mutate(changes)
  }

  return (
    <form onSubmit={submit} className="flex flex-col" style={col(12)}>
      <div className="flex flex-col" style={col(6)}>
        <label className="text-sm font-semibold">الاسم</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="الاسم"
          className={inputClass}
          style={pad(12, 16)}
        />
      </div>

      <div className="flex flex-col" style={col(6)}>
        <label className="text-sm font-semibold">الإيميل</label>
        <input
          type="email"
          dir="ltr"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="الإيميل"
          className={`${inputClass} text-left`}
          style={pad(12, 16)}
        />
      </div>

      <div className="flex flex-col" style={col(6)}>
        <label className="text-sm font-semibold">الباسورد الجديد</label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="سيبه فاضي لو مش عايز تغيّره"
        />
      </div>

      <div className="flex" style={col(8)}>
        <button
          type="submit"
          disabled={mutation.isPending}
          className={primaryBtnClass}
          style={pad(10, 16)}
        >
          {mutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className={ghostBtnClass}
            style={pad(10, 16)}
          >
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
    <form onSubmit={submit} className="flex flex-col" style={col(12)}>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="الاسم"
        className={inputClass}
        style={pad(12, 16)}
      />
      <input
        type="email"
        dir="ltr"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="الإيميل (مش لازم يكون حقيقي)"
        className={`${inputClass} text-left`}
        style={pad(12, 16)}
      />
      <PasswordInput value={password} onChange={setPassword} />
      <button
        type="submit"
        disabled={mutation.isPending}
        className={`${primaryBtnClass} w-full`}
        style={pad(10, 16)}
      >
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
    <div
      className="rounded-2xl border border-ink-700 bg-ink-900"
      style={pad(20)}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 16, gap: 8 }}
      >
        <h3 className="font-bold">{label}</h3>
        <span
          className={`rounded-full text-xs font-semibold ${
            account
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-ink-800 text-ink-400'
          }`}
          style={pad(4, 12)}
        >
          {account ? 'مفعّل' : 'لسه مفيش حساب'}
        </span>
      </div>

      {account ? (
        <div className="flex flex-col" style={col(16)}>
          <dl className="flex flex-col text-sm" style={col(12)}>
            <div className="flex items-center justify-between" style={col(12)}>
              <dt className="text-ink-400">الاسم</dt>
              <dd className="truncate font-semibold">{account.full_name}</dd>
            </div>
            <div className="flex items-center justify-between" style={col(12)}>
              <dt className="text-ink-400">الإيميل</dt>
              <dd dir="ltr" className="truncate font-semibold">
                {account.email ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between" style={col(12)}>
              <dt className="text-ink-400">الباسورد</dt>
              <dd className="flex items-center" style={col(4)}>
                <span dir="ltr" className="font-mono font-semibold">
                  {showPassword ? account.password ?? '—' : '••••••••'}
                </span>
                <button
                  type="button"
                  aria-label={showPassword ? 'إخفاء الباسورد' : 'إظهار الباسورد'}
                  className={iconBtnClass}
                  style={pad(6)}
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
                  style={pad(6)}
                  onClick={copyPassword}
                >
                  <MdContentCopy size={18} />
                </button>
              </dd>
            </div>
          </dl>

          {changing ? (
            <EditAccountForm
              userId={account.id}
              initialName={account.full_name}
              initialEmail={account.email ?? ''}
              onDone={() => setChanging(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setChanging(true)}
              className={ghostBtnClass}
              style={pad(10, 16)}
            >
              تعديل (الاسم / الإيميل / الباسورد)
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
  const { profile, session } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  })

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 32 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">الإعدادات</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          حساب مدير الفرع وحساب السيلز لكل فرع، وتعديل الاسم والإيميل والباسورد.
        </p>
      </section>

      {profile && (
        <section
          className="rounded-2xl border border-ink-700 bg-ink-900"
          style={pad(20)}
        >
          <h2 className="font-bold" style={{ marginBottom: 4 }}>
            حسابك (المناجر)
          </h2>
          <p className="text-sm text-ink-400" style={{ marginBottom: 16 }}>
            غيّر الاسم أو الإيميل أو الباسورد بتاعك.
          </p>
          <div className="max-w-md">
            <EditAccountForm
              userId={profile.id}
              initialName={profile.full_name}
              initialEmail={session?.user.email ?? ''}
              isSelf
            />
          </div>
        </section>
      )}

      {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

      {error && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل الحسابات. اتأكد إنك شغّلت ملفات الـ SQL وإنك داخل بحساب
          المناجر.
        </p>
      )}

      {data?.branches.map((branch) => (
        <section key={branch.id} className="flex flex-col" style={col(16)}>
          <h2 className="text-xl font-bold">{branch.name}</h2>
          <div className="grid md:grid-cols-2" style={col(16)}>
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
