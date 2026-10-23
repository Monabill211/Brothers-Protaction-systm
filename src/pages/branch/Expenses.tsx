import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import { MdChevronLeft, MdChevronRight, MdDeleteOutline } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import {
  PERIODS,
  getRange,
  rangeLabel,
  shift,
  type Period,
} from '../../lib/periods'

type Expense = {
  id: string
  amount: number
  reason: string
  expense_date: string
}

const QUICK_REASONS = ['إيجار', 'كهربا', 'مياه', 'صيانة', 'أدوات']

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const primaryBtnClass =
  'rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

// تاريخ النهارده بتوقيت مصر (YYYY-MM-DD)
function cairoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
    new Date()
  )
}

function toNumber(value: string) {
  if (value.trim() === '') return NaN
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// ---------- الداتا ----------

async function fetchExpenses(from: string, to: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount, reason, expense_date')
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    reason: r.reason as string,
    expense_date: r.expense_date as string,
  }))
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

// ---------- إضافة مصروف ----------

function AddExpenseForm() {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => cairoToday())

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        amount: toNumber(amount),
        reason: reason.trim(),
        expense_date: date,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تسجيل المصروف')
      setAmount('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error('مقدرتش أسجل المصروف. اتأكد إنك داخل بحساب مدير الفرع')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = toNumber(amount)
    if (Number.isNaN(n) || n <= 0) {
      toast.error('اكتب المبلغ بشكل صحيح')
      return
    }
    if (!reason.trim()) {
      toast.error('اكتب سبب المصروف')
      return
    }
    if (!date) {
      toast.error('اختار التاريخ')
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
      <h2 className="font-bold">تسجيل مصروف</h2>

      <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="exp-amount" className="text-sm font-semibold">
            المبلغ
          </label>
          <MoneyInput
            id="exp-amount"
            value={amount}
            onChange={setAmount}
            placeholder="500"
          />
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="exp-date" className="text-sm font-semibold">
            التاريخ
          </label>
          <input
            id="exp-date"
            type="date"
            dir="ltr"
            value={date}
            max={cairoToday()}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} text-left`}
            style={pad(12, 16)}
          />
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 8 }}>
        <label htmlFor="exp-reason" className="text-sm font-semibold">
          السبب
        </label>
        <input
          id="exp-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثلاً: إيجار الشهر"
          className={inputClass}
          style={pad(12, 16)}
        />
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-ink-700 text-xs font-semibold text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              style={pad(4, 12)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className={`${primaryBtnClass} self-start`}
        style={pad(10, 20)}
      >
        {mutation.isPending ? 'جاري التسجيل...' : 'تسجيل المصروف'}
      </button>
    </form>
  )
}

// ---------- صف المصروف ----------

function ExpenseRow({ expense }: { expense: Expense }) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم مسح المصروف')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error('مقدرتش أمسح المصروف')
    },
  })

  function remove() {
    if (window.confirm(`تمسح مصروف "${expense.reason}"؟`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <div
      className={`${cardClass} flex items-center justify-between`}
      style={{ ...pad(14, 20), gap: 12 }}
    >
      <div className="min-w-0">
        <p className="truncate font-bold">{expense.reason}</p>
        <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
          {format(parseISO(expense.expense_date), 'EEEE d MMMM yyyy', {
            locale: ar,
          })}
        </p>
      </div>

      <div className="flex shrink-0 items-center" style={{ gap: 8 }}>
        <span dir="ltr" className="font-bold">
          {money(expense.amount)}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={deleteMutation.isPending}
          aria-label="مسح المصروف"
          className="rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-brand-400 disabled:opacity-50"
          style={pad(6)}
        >
          <MdDeleteOutline size={22} />
        </button>
      </div>
    </div>
  )
}

// ---------- الصفحة ----------

export default function Expenses() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null

  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(() => new Date())

  const { from, to } = getRange(period, anchor)
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')
  const includesToday = isWithinInterval(new Date(), { start: from, end: to })

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', fromStr, toStr],
    queryFn: () => fetchExpenses(fromStr, toStr),
    enabled: !!branchId,
  })

  const expenses = data ?? []
  const total = Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100

  const navBtnClass =
    'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
    'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">المصروفات</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          مصروفات الفرع العامة (إيجار، كهربا، أدوات...) مع السبب.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي لمدير الفرع بس. ادخل بحساب مدير فرع عشان تسجل المصروفات.
        </p>
      )}

      {branchId && <AddExpenseForm />}

      {branchId && (
        <>
          {/* اختيار الفترة */}
          <div
            className="flex w-full rounded-xl border border-ink-700 bg-ink-900 sm:max-w-md"
            style={{ ...pad(4), gap: 4 }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key)
                  setAnchor(new Date())
                }}
                className={`flex-1 rounded-lg text-sm font-semibold transition ${
                  period === p.key
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
                }`}
                style={pad(8, 8)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* التنقل بين الفترات */}
          <div
            className="flex items-center justify-between"
            style={{ gap: 8 }}
          >
            <button
              type="button"
              aria-label="الفترة السابقة"
              onClick={() => setAnchor((a) => shift(period, a, -1))}
              className={navBtnClass}
              style={pad(8)}
            >
              <MdChevronRight size={24} />
            </button>

            <div
              className="flex min-w-0 flex-col items-center text-center"
              style={{ gap: 4 }}
            >
              <p className="font-bold">{rangeLabel(period, from, to)}</p>
              {!includesToday && (
                <button
                  type="button"
                  onClick={() => setAnchor(new Date())}
                  className="text-sm font-semibold text-brand-400 hover:underline"
                >
                  ارجع للفترة الحالية
                </button>
              )}
            </div>

            <button
              type="button"
              aria-label="الفترة التالية"
              disabled={includesToday}
              onClick={() => setAnchor((a) => shift(period, a, 1))}
              className={navBtnClass}
              style={pad(8)}
            >
              <MdChevronLeft size={24} />
            </button>
          </div>

          {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

          {error && (
            <p
              className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
              style={pad(16)}
            >
              مقدرتش أحمّل المصروفات. اتأكد إنك داخل بحساب مدير الفرع وإن ملفات
              الـ SQL اتشغلت.
            </p>
          )}

          {data && (
            <>
              <section
                className={`${cardClass} flex items-center justify-between`}
                style={{ ...pad(20), gap: 12 }}
              >
                <div>
                  <p className="text-sm text-ink-400">إجمالي المصروفات</p>
                  <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
                    {expenses.length} مصروف
                  </p>
                </div>
                <p dir="ltr" className="text-2xl font-bold">
                  {money(total)}
                </p>
              </section>

              {expenses.length === 0 ? (
                <p className="text-ink-400">مفيش مصروفات في الفترة دي.</p>
              ) : (
                <section className="flex flex-col" style={{ gap: 12 }}>
                  {expenses.map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </section>
              )}

              <p className="text-xs text-ink-400">
                المصروفات دي بتظهر في الملخصات المالية بتاعت المناجر تحت
                &quot;مصروفات عامة&quot; حسب تاريخ المصروف.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
