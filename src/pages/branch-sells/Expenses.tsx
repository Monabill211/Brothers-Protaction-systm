import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import { MdDeleteOutline } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import MoneyInput from '../../components/MoneyInput'

type Expense = {
  id: string
  amount: number
  reason: string
  created_at: string
}

const QUICK_REASONS = ['شاي وقهوة', 'مواصلات', 'نظافة', 'أدوات', 'صيانة']

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const primaryBtnClass =
  'rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

// تاريخ النهارده بتوقيت مصر (YYYY-MM-DD)، نفس اللي قاعدة البيانات بتعتمد عليه
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

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------- الداتا ----------

// قاعدة البيانات بترجّع للسيلز اللي سجّله هو بس
async function fetchToday(day: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount, reason, created_at')
    .eq('expense_date', day)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    reason: r.reason as string,
    created_at: r.created_at as string,
  }))
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
      queryClient.invalidateQueries({ queryKey: ['sales-expenses'] })
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
          <span dir="ltr">{timeLabel(expense.created_at)}</span>
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

export default function SalesExpenses() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const branchId = profile?.branch_id ?? null
  const today = cairoToday()

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-expenses', today],
    queryFn: () => fetchToday(today),
    enabled: !!branchId,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        amount: toNumber(amount),
        reason: reason.trim(),
        expense_date: today,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تسجيل المصروف')
      setAmount('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['sales-expenses'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error('مقدرتش أسجل المصروف. اتأكد إنك داخل بحساب سيلز وإن ملف 09 اتشغّل')
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
    mutation.mutate()
  }

  const expenses = data ?? []
  const total =
    Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100

  return (
    <div className="flex max-w-3xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">المصروفات</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي للسيلز بس. ادخل بحساب سيلز عشان تسجل المصروفات.
        </p>
      )}

      {branchId && (
        <form
          onSubmit={submit}
          className={`${cardClass} flex flex-col`}
          style={{ ...pad(20), gap: 16 }}
        >
          <h2 className="font-bold">تسجيل مصروف</h2>

          <div className="flex flex-col sm:max-w-xs" style={{ gap: 8 }}>
            <label htmlFor="sx-amount" className="text-sm font-semibold">
              المبلغ
            </label>
            <MoneyInput
              id="sx-amount"
              value={amount}
              onChange={setAmount}
              placeholder="50"
            />
          </div>

          <div className="flex flex-col" style={{ gap: 8 }}>
            <label htmlFor="sx-reason" className="text-sm font-semibold">
              السبب
            </label>
            <input
              id="sx-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: شاي وقهوة للموظفين"
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
      )}

      {branchId && (
        <section className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <h2 className="text-xl font-bold">اللي سجّلته النهارده</h2>
            {expenses.length > 0 && (
              <span dir="ltr" className="font-bold">
                {money(total)}
              </span>
            )}
          </div>

          {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

          {error && (
            <p
              className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
              style={pad(16)}
            >
              مقدرتش أحمّل المصروفات. اتأكد إنك داخل بحساب سيلز وإن ملف 09 اتشغّل.
            </p>
          )}

          {data && expenses.length === 0 && (
            <p className="text-ink-400">لسه ماسجلتش مصروفات النهارده.</p>
          )}

          {expenses.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} />
          ))}

          <p className="text-xs text-ink-400">
            مدير الفرع والمناجر بيشوفوا المصروفات دي، وبتتحسب في الملخصات
            المالية. تقدر تمسح المصروف اللي سجلته النهارده بس.
          </p>
        </section>
      )}
    </div>
  )
}
