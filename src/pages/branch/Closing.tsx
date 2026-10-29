import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addWeeks,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  MdChevronLeft,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
  MdLock,
  MdPrint,
  MdWarningAmber,
} from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import { BRAND } from '../../lib/brand'
import {
  bandHeader,
  esc,
  footerHtml,
  longDate,
  num,
  openPrintWindow,
} from '../../lib/printTheme'

type Totals = {
  invoices_count: number
  revenue: number
  manual_revenue: number
  job_expenses: number
  general_expenses: number
  payroll: number
  payroll_employees: number
  unapproved_employees: number
}

type Closing = {
  closed_at: string
  invoices_count: number
  revenue: number
  job_expenses: number
  general_expenses: number
  payroll: number
  net: number
  notes: string | null
}

type InvoiceRow = {
  id: string
  invoice_no: number
  kind: string
  total_price: number
  created_at: string
  customer: string
}
type JobExpenseRow = {
  description: string
  amount: number
  invoice_no: number | null
}
type GeneralExpenseRow = {
  id: string
  reason: string
  amount: number
  expense_date: string
  by: string | null
}
type PayrollRow = { employee: string; days: number; total: number }

type Details = {
  invoices: InvoiceRow[]
  jobExpenses: JobExpenseRow[]
  generalExpenses: GeneralExpenseRow[]
  payroll: PayrollRow[]
  branchName: string
}

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const primaryBtnClass =
  'flex items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'flex items-center justify-center rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60'

const round2 = (n: number) => Math.round(n * 100) / 100

// PostgREST ممكن يرجّع العلاقة كـ object أو array
function one<T>(v: unknown): T | undefined {
  return (Array.isArray(v) ? v[0] : v) as T | undefined
}

// ---------- الداتا ----------

async function fetchTotals(weekStart: string): Promise<Totals> {
  const { data, error } = await supabase.rpc('branch_weekly_totals', {
    p_week_start: weekStart,
  })
  if (error) throw error

  const r = ((data ?? []) as Record<string, unknown>[])[0]
  if (!r) throw new Error('no totals')

  return {
    invoices_count: Number(r.invoices_count),
    revenue: Number(r.revenue),
    manual_revenue: Number(r.manual_revenue),
    job_expenses: Number(r.job_expenses),
    general_expenses: Number(r.general_expenses),
    payroll: Number(r.payroll),
    payroll_employees: Number(r.payroll_employees),
    unapproved_employees: Number(r.unapproved_employees),
  }
}

async function fetchClosing(weekStart: string): Promise<Closing | null> {
  const { data, error } = await supabase
    .from('weekly_closings')
    .select(
      'closed_at, invoices_count, revenue, job_expenses, general_expenses, payroll, net, notes'
    )
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    closed_at: String(data.closed_at),
    invoices_count: Number(data.invoices_count),
    revenue: Number(data.revenue),
    job_expenses: Number(data.job_expenses),
    general_expenses: Number(data.general_expenses),
    payroll: Number(data.payroll),
    net: Number(data.net),
    notes: (data.notes as string | null) ?? null,
  }
}

async function fetchDetails(
  branchId: string,
  from: Date,
  to: Date
): Promise<Details> {
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')

  const [inv, jobExp, genExp, pay, branch] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_no, kind, total_price, created_at, customers(name)')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('invoice_expenses')
      .select('description, amount, created_at, invoices(invoice_no)')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, reason, amount, expense_date, profiles(full_name)')
      .gte('expense_date', fromStr)
      .lte('expense_date', toStr)
      .order('expense_date', { ascending: true }),
    supabase
      .from('payroll_runs')
      .select('days_worked, total_amount, employees(full_name)')
      .eq('week_start', fromStr),
    supabase.from('branches').select('name').eq('id', branchId).maybeSingle(),
  ])

  for (const r of [inv, jobExp, genExp, pay]) if (r.error) throw r.error

  const rows = (d: unknown) => (d ?? []) as unknown as Record<string, unknown>[]

  return {
    invoices: rows(inv.data).map((r) => ({
      id: String(r.id),
      invoice_no: Number(r.invoice_no),
      kind: String(r.kind),
      total_price: Number(r.total_price),
      created_at: String(r.created_at),
      customer: one<{ name?: string }>(r.customers)?.name ?? '—',
    })),
    jobExpenses: rows(jobExp.data).map((r) => ({
      description: String(r.description),
      amount: Number(r.amount),
      invoice_no: one<{ invoice_no?: number }>(r.invoices)?.invoice_no ?? null,
    })),
    generalExpenses: rows(genExp.data).map((r) => ({
      id: String(r.id),
      reason: String(r.reason),
      amount: Number(r.amount),
      expense_date: String(r.expense_date),
      by: one<{ full_name?: string }>(r.profiles)?.full_name ?? null,
    })),
    payroll: rows(pay.data).map((r) => ({
      employee: one<{ full_name?: string }>(r.employees)?.full_name ?? '—',
      days: Number(r.days_worked),
      total: Number(r.total_amount),
    })),
    branchName: (branch.data?.name as string | undefined) ?? '',
  }
}

// ---------- الطباعة / PDF ----------

function closingHtml(
  period: string,
  t: Totals,
  d: Details,
  closing: Closing | null
) {
  const out = t.job_expenses + t.general_expenses + t.payroll
  const net = round2(t.revenue - out)

  const invoicesTable = d.invoices.length
    ? `<table>
      <thead><tr><th class="idx">#</th><th>العميل</th><th>النوع</th><th>المبلغ</th></tr></thead>
      <tbody>${d.invoices
        .map(
          (i) =>
            `<tr><td class="idx">${i.invoice_no}</td><td>${esc(
              i.customer
            )}</td><td>${i.kind === 'manual' ? 'عادية' : 'حماية'}</td><td dir="ltr">${num(
              i.total_price
            )}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="3">إجمالي الإيرادات (${d.invoices.length} فاتورة)</td><td dir="ltr">${num(
        t.revenue
      )}</td></tr></tfoot>
    </table>`
    : '<p class="muted">مفيش فواتير في الأسبوع ده.</p>'

  const jobTable = d.jobExpenses.length
    ? `<table>
      <thead><tr><th>البيان</th><th>الفاتورة</th><th>المبلغ</th></tr></thead>
      <tbody>${d.jobExpenses
        .map(
          (e) =>
            `<tr><td>${esc(e.description)}</td><td>${
              e.invoice_no ? '#' + e.invoice_no : '—'
            }</td><td dir="ltr">${num(e.amount)}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="2">إجمالي مصروفات الشغل</td><td dir="ltr">${num(
        t.job_expenses
      )}</td></tr></tfoot>
    </table>`
    : '<p class="muted">مفيش مصروفات شغل.</p>'

  const genTable = d.generalExpenses.length
    ? `<table>
      <thead><tr><th>السبب</th><th>التاريخ</th><th>سجّله</th><th>المبلغ</th></tr></thead>
      <tbody>${d.generalExpenses
        .map(
          (e) =>
            `<tr><td>${esc(e.reason)}</td><td>${esc(
              format(parseISO(e.expense_date), 'd MMMM', { locale: ar })
            )}</td><td>${esc(e.by ?? '—')}</td><td dir="ltr">${num(
              e.amount
            )}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="3">إجمالي المصروفات العامة</td><td dir="ltr">${num(
        t.general_expenses
      )}</td></tr></tfoot>
    </table>`
    : '<p class="muted">مفيش مصروفات عامة.</p>'

  const payTable = d.payroll.length
    ? `<table>
      <thead><tr><th>الموظف</th><th>أيام الحضور</th><th>القبض</th></tr></thead>
      <tbody>${d.payroll
        .map(
          (p) =>
            `<tr><td>${esc(p.employee)}</td><td>${p.days}</td><td dir="ltr">${num(
              p.total
            )}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="2">إجمالي قبض الموظفين</td><td dir="ltr">${num(
        t.payroll
      )}</td></tr></tfoot>
    </table>`
    : '<p class="muted">مفيش قبض معتمد للأسبوع ده.</p>'

  return `
  <section class="page">
    ${bandHeader({
      title: 'تقفيل أسبوعي',
      subtitle: period,
      badge: closing ? 'تم التقفيل' : 'لم يُقفل بعد',
    })}

    <div class="cards">
      <div class="card">
        <div class="label">الداخل (الإيرادات)</div>
        <div class="value" dir="ltr" style="text-align:right">${num(t.revenue)} ج.م</div>
      </div>
      <div class="card">
        <div class="label">الخارج (مصروفات + قبض)</div>
        <div class="value" dir="ltr" style="text-align:right">${num(out)} ج.م</div>
      </div>
      <div class="card">
        <div class="label">الصافي</div>
        <div class="value" dir="ltr" style="text-align:right">${num(net)} ج.م</div>
      </div>
    </div>

    <h3>الداخل: الفواتير</h3>
    ${invoicesTable}

    <h3>الخارج: مصروفات الشغل</h3>
    ${jobTable}

    <h3>الخارج: المصروفات العامة</h3>
    ${genTable}

    <h3>الخارج: قبض الموظفين</h3>
    ${payTable}

    <h3>الحساب</h3>
    <div class="summary">
      <div><span>إجمالي الداخل</span><span dir="ltr">${num(t.revenue)}</span></div>
      <div><span>مصروفات الشغل</span><span dir="ltr">${num(t.job_expenses)}</span></div>
      <div><span>المصروفات العامة</span><span dir="ltr">${num(t.general_expenses)}</span></div>
      <div><span>قبض الموظفين</span><span dir="ltr">${num(t.payroll)}</span></div>
    </div>

    <div class="total">
      <span>صافي الأسبوع</span>
      <span class="amount ${net >= 0 ? 'pos' : 'neg'}" dir="ltr">${num(net)} ج.م</span>
    </div>

    ${
      closing
        ? `<div class="note"><strong>تم التقفيل:</strong> ${esc(
            longDate(closing.closed_at)
          )}${closing.notes ? `<br/>${esc(closing.notes)}` : ''}</div>`
        : ''
    }
    <div class="note">${esc(BRAND.closingNote)}</div>

    <div class="sign">
      <div>توقيع مدير الفرع</div>
      <div>توقيع المناجر</div>
    </div>

    ${footerHtml(d.branchName)}
  </section>`
}

// ---------- مكونات صغيرة ----------

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
    <div className={cardClass} style={pad(18)}>
      <p className="text-sm text-ink-400">{label}</p>
      <p
        dir="ltr"
        className={`text-right text-2xl font-bold ${valueClass}`}
        style={{ marginTop: 6 }}
      >
        {money(value)}
      </p>
      {hint && (
        <p className="text-sm font-semibold" style={{ marginTop: 2 }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function Section({
  title,
  total,
  count,
  children,
}: {
  title: string
  total: number
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-start"
        style={{ ...pad(14, 20), gap: 12 }}
      >
        <div className="min-w-0">
          <p className="font-bold">{title}</p>
          <p className="text-xs text-ink-400" style={{ marginTop: 2 }}>
            {count} بند
          </p>
        </div>
        <div className="flex shrink-0 items-center" style={{ gap: 4 }}>
          <span dir="ltr" className="font-bold">
            {money(total)}
          </span>
          {open ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
        </div>
      </button>

      {open && (
        <div
          className="flex flex-col border-t border-ink-700 text-sm"
          style={{ ...pad(14, 20), gap: 10 }}
        >
          {count === 0 ? <p className="text-ink-400">مفيش بنود.</p> : children}
        </div>
      )}
    </div>
  )
}

function Item({
  title,
  sub,
  value,
}: {
  title: string
  sub?: string
  value: number
}) {
  return (
    <div className="flex items-start justify-between" style={{ gap: 12 }}>
      <div className="min-w-0">
        <p className="truncate">{title}</p>
        {sub && <p className="text-xs text-ink-400">{sub}</p>}
      </div>
      <span dir="ltr" className="shrink-0 font-semibold">
        {money(value)}
      </span>
    </div>
  )
}

// ---------- الصفحة ----------

export default function WeeklyClosing() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const branchId = profile?.branch_id ?? null

  const [anchor, setAnchor] = useState(() => new Date())
  const [notes, setNotes] = useState('')

  // الأسبوع من السبت للجمعة
  const from = startOfWeek(anchor, { weekStartsOn: 6 })
  const to = endOfWeek(anchor, { weekStartsOn: 6 })
  const fromStr = format(from, 'yyyy-MM-dd')
  const includesToday = isWithinInterval(new Date(), { start: from, end: to })
  const period = `من ${format(from, 'd MMMM', { locale: ar })} إلى ${format(
    to,
    'd MMMM yyyy',
    { locale: ar }
  )}`

  const totalsQuery = useQuery({
    queryKey: ['closing-totals', fromStr],
    queryFn: () => fetchTotals(fromStr),
    enabled: !!branchId,
  })
  const closingQuery = useQuery({
    queryKey: ['closing-saved', fromStr],
    queryFn: () => fetchClosing(fromStr),
    enabled: !!branchId,
  })
  const detailsQuery = useQuery({
    queryKey: ['closing-details', branchId, fromStr],
    queryFn: () => fetchDetails(branchId as string, from, to),
    enabled: !!branchId,
  })

  const t = totalsQuery.data
  const closing = closingQuery.data ?? null
  const details = detailsQuery.data

  const outTotal = t ? t.job_expenses + t.general_expenses + t.payroll : 0
  const net = t ? round2(t.revenue - outTotal) : 0
  const blocked = !!t && t.unapproved_employees > 0
  const changed =
    !!t &&
    !!closing &&
    (Math.abs(closing.revenue - t.revenue) > 0.005 ||
      Math.abs(closing.job_expenses - t.job_expenses) > 0.005 ||
      Math.abs(closing.general_expenses - t.general_expenses) > 0.005 ||
      Math.abs(closing.payroll - t.payroll) > 0.005)

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('close_week', {
        p_week_start: fromStr,
        p_notes: notes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(closing ? 'تم تحديث التقفيل' : 'تم تقفيل الأسبوع')
      setNotes('')
      queryClient.invalidateQueries({ queryKey: ['closing-saved'] })
      queryClient.invalidateQueries({ queryKey: ['closing-totals'] })
    },
    onError: (e) => {
      const msg = (e as { message?: string })?.message ?? ''
      if (msg.includes('unapproved payroll')) {
        toast.error(
          'فيه موظفين قبضهم لسه ماتعتمدش أو اتغيّر. اعتمدهم من القبض الأسبوعي الأول'
        )
      } else {
        console.error(e)
        toast.error('مقدرتش أقفل الأسبوع. اتأكد إن ملف 14 اتشغّل وإنك داخل بحساب مدير فرع')
      }
    },
  })

  const navBtnClass =
    'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
    'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">التقفيل الأسبوعي</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          كل الفلوس اللي دخلت وخرجت من الفرع في الأسبوع: فواتير، ومصروفات، وقبض
          الموظفين.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي لمدير الفرع بس. ادخل بحساب مدير فرع عشان تقفل الأسبوع.
        </p>
      )}

      {/* التنقل بين الأسابيع */}
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <button
          type="button"
          aria-label="الأسبوع السابق"
          onClick={() => setAnchor((a) => addWeeks(a, -1))}
          className={navBtnClass}
          style={pad(8)}
        >
          <MdChevronRight size={24} />
        </button>

        <div
          className="flex min-w-0 flex-col items-center text-center"
          style={{ gap: 4 }}
        >
          <p className="font-bold">{period}</p>
          {!includesToday && (
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="text-sm font-semibold text-brand-400 hover:underline"
            >
              ارجع للأسبوع الحالي
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label="الأسبوع التالي"
          disabled={includesToday}
          onClick={() => setAnchor((a) => addWeeks(a, 1))}
          className={navBtnClass}
          style={pad(8)}
        >
          <MdChevronLeft size={24} />
        </button>
      </div>

      {branchId &&
        (totalsQuery.isLoading ||
          closingQuery.isLoading ||
          detailsQuery.isLoading) && (
          <p className="text-ink-400">جاري التحميل...</p>
        )}

      {(totalsQuery.error || closingQuery.error || detailsQuery.error) && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل التقفيل. اتأكد إنك داخل بحساب مدير فرع وإن ملف
          14_weekly_closing.sql اتشغّل.
        </p>
      )}

      {t && details && (
        <>
          {/* داخل / خارج / صافي */}
          <section className="grid sm:grid-cols-3" style={{ gap: 12 }}>
            <Stat
              label="الداخل (الإيرادات)"
              value={t.revenue}
              valueClass="text-emerald-400"
              hint={`${t.invoices_count} فاتورة`}
            />
            <Stat label="الخارج (مصروفات + قبض)" value={outTotal} />
            <Stat
              label="الصافي"
              value={net}
              valueClass={
                net > 0
                  ? 'text-emerald-400'
                  : net < 0
                    ? 'text-brand-400'
                    : 'text-ink-400'
              }
              hint={net > 0 ? 'كسبان' : net < 0 ? 'خسران' : 'متعادل'}
            />
          </section>

          {/* حالة التقفيل */}
          <section
            className={`${cardClass} flex flex-col`}
            style={{ ...pad(20), gap: 14 }}
          >
            <div className="flex items-center" style={{ gap: 8 }}>
              <MdLock
                size={22}
                className={closing ? 'text-emerald-400' : 'text-ink-400'}
              />
              <h2 className="font-bold">
                {closing ? 'الأسبوع مقفول' : 'الأسبوع لسه مش مقفول'}
              </h2>
            </div>

            {closing && (
              <p className="text-sm text-ink-400">
                اتقفل بتاريخ {longDate(closing.closed_at)}
                {closing.notes ? ` • ${closing.notes}` : ''}
              </p>
            )}

            {changed && (
              <p
                className="flex items-start rounded-lg bg-amber-500/10 text-sm text-amber-300"
                style={{ ...pad(10, 12), gap: 8 }}
              >
                <MdWarningAmber size={20} className="shrink-0" />
                فيه تغييرات اتسجلت بعد التقفيل (فواتير أو مصروفات أو قبض). دوس
                &quot;تحديث التقفيل&quot; عشان الأرقام المحفوظة تتحدّث.
              </p>
            )}

            {blocked && (
              <p
                className="flex items-start rounded-lg bg-brand-600/10 text-sm text-brand-400"
                style={{ ...pad(10, 12), gap: 8 }}
              >
                <MdWarningAmber size={20} className="shrink-0" />
                <span>
                  فيه {t.unapproved_employees} موظف قبضهم لسه ماتعتمدش أو اتغيّر.
                  لازم تعتمده الأول من{' '}
                  <Link to="/branch/payroll" className="font-bold underline">
                    القبض الأسبوعي
                  </Link>{' '}
                  وبعدها تقفل الأسبوع.
                </span>
              </p>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات على الأسبوع (اختياري)"
              rows={2}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 placeholder:text-ink-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              style={pad(12, 16)}
            />

            <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
              <button
                type="button"
                disabled={closeMutation.isPending || blocked}
                onClick={() => closeMutation.mutate()}
                className={primaryBtnClass}
                style={{ ...pad(12, 20), gap: 6 }}
              >
                <MdLock size={18} />
                {closeMutation.isPending
                  ? 'جاري التقفيل...'
                  : closing
                    ? 'تحديث التقفيل'
                    : 'تقفيل الأسبوع'}
              </button>
              <button
                type="button"
                onClick={() =>
                  openPrintWindow(
                    `تقفيل أسبوعي - ${period}`,
                    closingHtml(period, t, details, closing)
                  )
                }
                className={ghostBtnClass}
                style={{ ...pad(12, 20), gap: 6 }}
              >
                <MdPrint size={18} />
                طباعة / PDF
              </button>
            </div>
          </section>

          {/* التفاصيل */}
          <section className="flex flex-col" style={{ gap: 12 }}>
            <h2 className="text-xl font-bold">التفاصيل</h2>

            <Section
              title="الداخل: الفواتير"
              total={t.revenue}
              count={details.invoices.length}
            >
              {details.invoices.map((i) => (
                <Item
                  key={i.id}
                  title={`#${i.invoice_no} • ${i.customer}`}
                  sub={i.kind === 'manual' ? 'فاتورة عادية' : 'فاتورة حماية'}
                  value={i.total_price}
                />
              ))}
            </Section>

            <Section
              title="الخارج: مصروفات الشغل"
              total={t.job_expenses}
              count={details.jobExpenses.length}
            >
              {details.jobExpenses.map((e, idx) => (
                <Item
                  key={idx}
                  title={e.description}
                  sub={e.invoice_no ? `فاتورة #${e.invoice_no}` : undefined}
                  value={e.amount}
                />
              ))}
            </Section>

            <Section
              title="الخارج: المصروفات العامة"
              total={t.general_expenses}
              count={details.generalExpenses.length}
            >
              {details.generalExpenses.map((e) => (
                <Item
                  key={e.id}
                  title={e.reason}
                  sub={`${format(parseISO(e.expense_date), 'EEEE d MMMM', {
                    locale: ar,
                  })}${e.by ? ` • سجّله: ${e.by}` : ''}`}
                  value={e.amount}
                />
              ))}
            </Section>

            <Section
              title="الخارج: قبض الموظفين"
              total={t.payroll}
              count={details.payroll.length}
            >
              {details.payroll.map((p, idx) => (
                <Item
                  key={idx}
                  title={p.employee}
                  sub={`${p.days} يوم حضور`}
                  value={p.total}
                />
              ))}
            </Section>
          </section>

          {/* الحساب */}
          <section
            className={`${cardClass} flex flex-col text-sm`}
            style={{ ...pad(20), gap: 10 }}
          >
            <Line label="إجمالي الداخل" value={t.revenue} />
            <Line label="مصروفات الشغل" value={t.job_expenses} />
            <Line label="المصروفات العامة" value={t.general_expenses} />
            <Line label="قبض الموظفين" value={t.payroll} />
            <div className="border-t border-ink-700" style={{ marginTop: 2 }} />
            <Line
              label="صافي الأسبوع"
              value={net}
              strong
              valueClass={
                net > 0
                  ? 'text-emerald-400'
                  : net < 0
                    ? 'text-brand-400'
                    : ''
              }
            />
          </section>

          <p className="text-xs text-ink-400">
            الأرقام بتتحسب من قاعدة البيانات مباشرة. التقفيل بيحفظ نسخة من
            أرقام الأسبوع، ومش بيمنع تسجيل حاجة بعده، لكن لو حصلت تغييرات بتظهر
            لك ملحوظة وتقدر تحدّث التقفيل.
          </p>
        </>
      )}
    </div>
  )
}
