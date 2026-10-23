import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MdCheck, MdClose, MdEdit } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'

type Employee = {
  id: string
  full_name: string
  daily_rate: number
  is_active: boolean
}

type Section = 'front' | 'back' | 'side_one' | 'side_two'
type Rates = Partial<Record<Section, number>>

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'front', label: 'الوش' },
  { key: 'back', label: 'الضهر' },
  { key: 'side_one', label: 'جنب واحد' },
  { key: 'side_two', label: 'جنب اتنين' },
]

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const primaryBtnClass =
  'rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800'

// ---------- helpers ----------

function toNumber(value: string) {
  if (value.trim() === '') return NaN
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function fail(e: unknown) {
  console.error(e)
  toast.error('مقدرتش أحفظ. اتأكد إنك داخل بحساب مدير الفرع')
}

async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, daily_rate, is_active')
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    daily_rate: Number(r.daily_rate),
    is_active: r.is_active as boolean,
  }))
}

async function fetchRates(): Promise<Rates> {
  const { data, error } = await supabase
    .from('service_rates')
    .select('section, rate')
  if (error) throw error

  const rates: Rates = {}
  for (const row of data ?? []) {
    rates[row.section as Section] = Number(row.rate)
  }
  return rates
}

// ---------- مبلغ بالجنيه ----------

function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} text-left`}
        style={{ ...pad(12, 16), paddingRight: 56 }}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-400">
        ج.م
      </span>
    </div>
  )
}

// ---------- إضافة موظف ----------

function AddEmployeeForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [dailyRate, setDailyRate] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('employees').insert({
        full_name: name.trim(),
        daily_rate: toNumber(dailyRate),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم إضافة الموظف')
      setName('')
      setDailyRate('')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: fail,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('اكتب اسم الموظف')
      return
    }
    const rate = toNumber(dailyRate)
    if (Number.isNaN(rate) || rate < 0) {
      toast.error('اكتب اليومية بشكل صحيح')
      return
    }
    mutation.mutate()
  }

  return (
    <form
      onSubmit={submit}
      className={`${cardClass} flex flex-col`}
      style={{ ...pad(20), gap: 16 }}
    >
      <h2 className="font-bold">إضافة موظف</h2>

      <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="emp-name" className="text-sm font-semibold">
            اسم الموظف
          </label>
          <input
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: أحمد محمد"
            className={inputClass}
            style={pad(12, 16)}
          />
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="emp-rate" className="text-sm font-semibold">
            اليومية
          </label>
          <MoneyInput
            id="emp-rate"
            value={dailyRate}
            onChange={setDailyRate}
            placeholder="300"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className={`${primaryBtnClass} self-start`}
        style={pad(10, 20)}
      >
        {mutation.isPending ? 'جاري الإضافة...' : 'إضافة الموظف'}
      </button>
    </form>
  )
}

// ---------- نسب الشغل ----------

function RatesCard({ branchId, rates }: { branchId: string; rates: Rates }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<Section, string>>(() => ({
    front: rates.front?.toString() ?? '',
    back: rates.back?.toString() ?? '',
    side_one: rates.side_one?.toString() ?? '',
    side_two: rates.side_two?.toString() ?? '',
  }))

  const mutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      const rows = SECTIONS.map((s) => ({
        branch_id: branchId,
        section: s.key,
        rate: toNumber(values[s.key]),
        updated_at: now,
      }))
      const { error } = await supabase
        .from('service_rates')
        .upsert(rows, { onConflict: 'branch_id,section' })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حفظ النسب')
      queryClient.invalidateQueries({ queryKey: ['service-rates'] })
    },
    onError: fail,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = SECTIONS.some((s) => {
      const n = toNumber(values[s.key])
      return Number.isNaN(n) || n < 0
    })
    if (invalid) {
      toast.error('اكتب نسبة كل جزء بشكل صحيح')
      return
    }
    mutation.mutate()
  }

  return (
    <form
      onSubmit={submit}
      className={`${cardClass} flex flex-col`}
      style={{ ...pad(20), gap: 16 }}
    >
      <div>
        <h2 className="font-bold">نسب الشغل</h2>
        <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
          المبلغ الثابت اللي الموظف بياخده على كل جزء في العربية، وبيتحسب منه
          القبض الأسبوعي.
        </p>
      </div>

      <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
        {SECTIONS.map((s) => (
          <div key={s.key} className="flex flex-col" style={{ gap: 8 }}>
            <label htmlFor={`rate-${s.key}`} className="text-sm font-semibold">
              {s.label}
            </label>
            <MoneyInput
              id={`rate-${s.key}`}
              value={values[s.key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className={`${primaryBtnClass} self-start`}
        style={pad(10, 20)}
      >
        {mutation.isPending ? 'جاري الحفظ...' : 'حفظ النسب'}
      </button>
    </form>
  )
}

// ---------- كارت الموظف ----------

function EmployeeCard({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(employee.full_name)
  const [dailyRate, setDailyRate] = useState(String(employee.daily_rate))

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employees')
        .update({ full_name: name.trim(), daily_rate: toNumber(dailyRate) })
        .eq('id', employee.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حفظ التعديل')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: fail,
  })

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: fail,
  })

  function save(e: FormEvent) {
    e.preventDefault()
    const rate = toNumber(dailyRate)
    if (!name.trim() || Number.isNaN(rate) || rate < 0) {
      toast.error('اكتب الاسم واليومية بشكل صحيح')
      return
    }
    updateMutation.mutate()
  }

  function cancel() {
    setName(employee.full_name)
    setDailyRate(String(employee.daily_rate))
    setEditing(false)
  }

  return (
    <div
      className={`${cardClass} flex flex-col ${
        employee.is_active ? '' : 'opacity-60'
      }`}
      style={{ ...pad(20), gap: 16 }}
    >
      {editing ? (
        <form onSubmit={save} className="flex flex-col" style={{ gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الموظف"
            className={inputClass}
            style={pad(12, 16)}
          />
          <MoneyInput value={dailyRate} onChange={setDailyRate} />
          <div className="flex" style={{ gap: 8 }}>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className={`${primaryBtnClass} flex items-center`}
              style={{ ...pad(10, 16), gap: 6 }}
            >
              <MdCheck size={18} />
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className={`${ghostBtnClass} flex items-center`}
              style={{ ...pad(10, 16), gap: 6 }}
            >
              <MdClose size={18} />
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <>
          <div
            className="flex items-start justify-between"
            style={{ gap: 8 }}
          >
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold">
                {employee.full_name}
              </h3>
              <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
                اليومية:{' '}
                <span dir="ltr" className="font-semibold text-ink-100">
                  {money(employee.daily_rate)}
                </span>
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full text-xs font-semibold ${
                employee.is_active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-ink-800 text-ink-400'
              }`}
              style={pad(4, 12)}
            >
              {employee.is_active ? 'شغّال' : 'موقوف'}
            </span>
          </div>

          <div className="flex" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`${ghostBtnClass} flex items-center`}
              style={{ ...pad(10, 16), gap: 6 }}
            >
              <MdEdit size={18} />
              تعديل
            </button>
            <button
              type="button"
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate()}
              className={`${ghostBtnClass} disabled:opacity-60`}
              style={pad(10, 16)}
            >
              {employee.is_active ? 'إيقاف' : 'تفعيل'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- الصفحة ----------

export default function Employees() {
  const { profile } = useAuth()
  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
  })
  const ratesQuery = useQuery({
    queryKey: ['service-rates'],
    queryFn: fetchRates,
  })

  const employees = employeesQuery.data ?? []
  const failed = employeesQuery.error || ratesQuery.error

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">الموظفين والنسب</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          أسماء الموظفين واليومية بتاعتهم، ونسب الوش والضهر والجنب.
        </p>
      </section>

      {failed && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل البيانات. اتأكد إنك داخل بحساب مدير الفرع (مش المناجر) وإن
          ملفات الـ SQL اتشغلت.
        </p>
      )}

      <AddEmployeeForm />

      {ratesQuery.data && profile?.branch_id && (
        <RatesCard branchId={profile.branch_id} rates={ratesQuery.data} />
      )}

      <section className="flex flex-col" style={{ gap: 16 }}>
        <h2 className="text-xl font-bold">
          الموظفين{employees.length > 0 ? ` (${employees.length})` : ''}
        </h2>

        {employeesQuery.isLoading && (
          <p className="text-ink-400">جاري التحميل...</p>
        )}

        {employeesQuery.data && employees.length === 0 && (
          <p className="text-ink-400">لسه مفيش موظفين، ضيف أول موظف من فوق.</p>
        )}

        <div className="grid md:grid-cols-2" style={{ gap: 16 }}>
          {employees.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      </section>
    </div>
  )
}
