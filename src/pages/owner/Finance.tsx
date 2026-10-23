import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'

type Period = 'day' | 'week' | 'month' | 'year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'يومي' },
  { key: 'week', label: 'أسبوعي' },
  { key: 'month', label: 'شهري' },
  { key: 'year', label: 'سنوي' },
]

const BRANCH_ORDER = ['الفرع الأول', 'الفرع الثاني', 'الفرع الثالث']

type Row = {
  branch_id: string
  branch_name: string
  invoices_count: number
  revenue: number
  job_expenses: number
  general_expenses: number
  payroll: number
}

const expensesOf = (r: Row) => r.job_expenses + r.general_expenses + r.payroll
const netOf = (r: Row) => r.revenue - expensesOf(r)

// ---------- الفترات ----------

// الأسبوع بيبدأ السبت (weekStartsOn: 6)
function getRange(period: Period, anchor: Date) {
  switch (period) {
    case 'day':
      return { from: startOfDay(anchor), to: endOfDay(anchor) }
    case 'week':
      return {
        from: startOfWeek(anchor, { weekStartsOn: 6 }),
        to: endOfWeek(anchor, { weekStartsOn: 6 }),
      }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    case 'year':
      return { from: startOfYear(anchor), to: endOfYear(anchor) }
  }
}

function shift(period: Period, anchor: Date, dir: 1 | -1) {
  switch (period) {
    case 'day':
      return addDays(anchor, dir)
    case 'week':
      return addWeeks(anchor, dir)
    case 'month':
      return addMonths(anchor, dir)
    case 'year':
      return addYears(anchor, dir)
  }
}

function rangeLabel(period: Period, from: Date, to: Date) {
  switch (period) {
    case 'day':
      return format(from, 'EEEE d MMMM yyyy', { locale: ar })
    case 'week':
      return `من ${format(from, 'd MMMM', { locale: ar })} إلى ${format(
        to,
        'd MMMM yyyy',
        { locale: ar }
      )}`
    case 'month':
      return format(from, 'MMMM yyyy', { locale: ar })
    case 'year':
      return format(from, 'yyyy')
  }
}

// ---------- الداتا ----------

async function fetchSummary(from: string, to: string): Promise<Row[]> {
  const { data, error } = await supabase.rpc('finance_summary', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      branch_id: String(r.branch_id),
      branch_name: String(r.branch_name),
      invoices_count: Number(r.invoices_count),
      revenue: Number(r.revenue),
      job_expenses: Number(r.job_expenses),
      general_expenses: Number(r.general_expenses),
      payroll: Number(r.payroll),
    }))
    .sort((a, b) => {
      const ia = BRANCH_ORDER.indexOf(a.branch_name)
      const ib = BRANCH_ORDER.indexOf(b.branch_name)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
}

// ---------- مكونات صغيرة ----------

function netStatus(net: number) {
  if (net > 0) return { label: 'كسبان', text: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-400' }
  if (net < 0) return { label: 'خسران', text: 'text-brand-400', chip: 'bg-brand-600/20 text-brand-400' }
  return { label: 'متعادل', text: 'text-ink-400', chip: 'bg-ink-800 text-ink-400' }
}

function Line({
  label,
  value,
  strong = false,
  valueClass = '',
}: {
  label: string
  value: number
  strong?: boolean
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12 }}>
      <span className={strong ? 'font-bold' : 'text-ink-400'}>{label}</span>
      <span
        dir="ltr"
        className={`${strong ? 'text-lg font-bold' : 'font-semibold'} ${valueClass}`}
      >
        {money(value)}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass = '',
  hint,
}: {
  label: string
  value: number
  valueClass?: string
  hint?: string
}) {
  return (
    <div
      className="rounded-2xl border border-ink-700 bg-ink-900"
      style={pad(20)}
    >
      <p className="text-sm text-ink-400">{label}</p>
      <p
        dir="ltr"
        className={`text-right text-2xl font-bold ${valueClass}`}
        style={{ marginTop: 8 }}
      >
        {money(value)}
      </p>
      {hint && (
        <p className="text-sm font-semibold" style={{ marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function BranchCard({ row }: { row: Row }) {
  const net = netOf(row)
  const status = netStatus(net)

  return (
    <div
      className="rounded-2xl border border-ink-700 bg-ink-900"
      style={pad(20)}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 16, gap: 8 }}
      >
        <h3 className="text-lg font-bold">{row.branch_name}</h3>
        <span
          className={`rounded-full text-xs font-semibold ${status.chip}`}
          style={pad(4, 12)}
        >
          {status.label}
        </span>
      </div>

      <div className="flex flex-col text-sm" style={{ gap: 12 }}>
        <Line label="الإيرادات" value={row.revenue} valueClass="text-emerald-400" />
        <Line label="مصروفات الشغل" value={row.job_expenses} />
        <Line label="مصروفات عامة" value={row.general_expenses} />
        <Line label="قبض الموظفين" value={row.payroll} />

        <div className="border-t border-ink-700" style={{ marginTop: 4 }} />

        <Line
          label="الصافي"
          value={net}
          strong
          valueClass={status.text}
        />

        <p className="text-xs text-ink-400">
          عدد الفواتير: {row.invoices_count}
        </p>
      </div>
    </div>
  )
}

// ---------- الصفحة ----------

export default function Finance() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState(() => new Date())

  const { from, to } = getRange(period, anchor)
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')
  const includesToday = isWithinInterval(new Date(), { start: from, end: to })

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', fromStr, toStr],
    queryFn: () => fetchSummary(fromStr, toStr),
  })

  const totals = (data ?? []).reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      expenses: acc.expenses + expensesOf(r),
    }),
    { revenue: 0, expenses: 0 }
  )
  const totalNet = totals.revenue - totals.expenses
  const totalStatus = netStatus(totalNet)

  const navBtnClass =
    'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
    'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">الملخصات المالية</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          الإيرادات والمصروفات والصافي لكل فرع.
        </p>
      </section>

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
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <button
          type="button"
          aria-label="الفترة السابقة"
          onClick={() => setAnchor((a) => shift(period, a, -1))}
          className={navBtnClass}
          style={pad(8)}
        >
          <MdChevronRight size={24} />
        </button>

        <div className="flex min-w-0 flex-col items-center text-center" style={{ gap: 4 }}>
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
          مقدرتش أحمّل الملخصات. اتأكد إنك شغّلت ملف 05_finance_summary.sql وإنك
          داخل بحساب المناجر.
        </p>
      )}

      {data && (
        <>
          {/* إجمالي كل الفروع */}
          <section
            className="grid sm:grid-cols-3"
            style={{ gap: 16 }}
          >
            <Stat
              label="إجمالي الإيرادات"
              value={totals.revenue}
              valueClass="text-emerald-400"
            />
            <Stat label="إجمالي المصروفات" value={totals.expenses} />
            <Stat
              label="الصافي (كل الفروع)"
              value={totalNet}
              valueClass={totalStatus.text}
              hint={totalStatus.label}
            />
          </section>

          {/* كل فرع لوحده */}
          <section
            className="grid md:grid-cols-2 xl:grid-cols-3"
            style={{ gap: 16 }}
          >
            {data.map((row) => (
              <BranchCard key={row.branch_id} row={row} />
            ))}
          </section>

          <p className="text-xs text-ink-400">
            قبض الموظفين بيتحسب في الفترة اللي فيها آخر يوم من الأسبوع. الصافي =
            الإيرادات − (مصروفات الشغل + المصروفات العامة + قبض الموظفين).
          </p>
        </>
      )}
    </div>
  )
}
