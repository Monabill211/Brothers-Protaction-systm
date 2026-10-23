import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isWithinInterval } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  MdChevronLeft,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
} from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import {
  PERIODS,
  getRange,
  rangeLabel,
  shift,
  type Period,
} from '../../lib/periods'

type Branch = { id: string; name: string }

type Invoice = {
  id: string
  invoice_no: number
  branch_id: string
  car_model: string | null
  plate_number: string | null
  total_price: number
  notes: string | null
  created_at: string
  customer_name: string
  customer_phone: string | null
  work: { section: string; rate: number; employee: string }[]
  expenses: { description: string; amount: number }[]
}

const BRANCH_ORDER = ['الفرع الأول', 'الفرع الثاني', 'الفرع الثالث']

const SECTION_LABEL: Record<string, string> = {
  front: 'الوش',
  back: 'الضهر',
  side_one: 'جنب واحد',
  side_two: 'جنب اتنين',
}

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------- الداتا ----------

// PostgREST ممكن يرجّع العلاقة كـ object أو array
function one<T>(v: unknown): T | undefined {
  return (Array.isArray(v) ? v[0] : v) as T | undefined
}

function parseInvoice(r: Record<string, unknown>): Invoice {
  const customer = one<{ name?: string; phone?: string | null }>(r.customers)

  const work = ((r.invoice_work ?? []) as Record<string, unknown>[]).map(
    (w) => ({
      section: String(w.section),
      rate: Number(w.rate),
      employee: one<{ full_name?: string }>(w.employees)?.full_name ?? '—',
    })
  )

  const expenses = (
    (r.invoice_expenses ?? []) as Record<string, unknown>[]
  ).map((e) => ({
    description: String(e.description),
    amount: Number(e.amount),
  }))

  return {
    id: String(r.id),
    invoice_no: Number(r.invoice_no),
    branch_id: String(r.branch_id),
    car_model: (r.car_model as string | null) ?? null,
    plate_number: (r.plate_number as string | null) ?? null,
    total_price: Number(r.total_price),
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    customer_name: customer?.name ?? '—',
    customer_phone: customer?.phone ?? null,
    work,
    expenses,
  }
}

async function fetchInvoices(from: Date, to: Date): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_no, branch_id, car_model, plate_number, total_price, notes, created_at, ' +
        'customers(name, phone), ' +
        'invoice_work(section, rate, employees(full_name)), ' +
        'invoice_expenses(description, amount)'
    )
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(
    parseInvoice
  )
}

async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('id, name')
  if (error) throw error

  return ([...(data ?? [])] as Branch[]).sort((a, b) => {
    const ia = BRANCH_ORDER.indexOf(a.name)
    const ib = BRANCH_ORDER.indexOf(b.name)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

// ---------- حسابات ----------

const jobExpensesOf = (inv: Invoice) =>
  round2(inv.expenses.reduce((s, e) => s + e.amount, 0))
const workCostOf = (inv: Invoice) =>
  round2(inv.work.reduce((s, w) => s + w.rate, 0))
const netOf = (inv: Invoice) =>
  round2(inv.total_price - jobExpensesOf(inv) - workCostOf(inv))

function tone(net: number) {
  if (net > 0) return 'text-emerald-400'
  if (net < 0) return 'text-brand-400'
  return 'text-ink-400'
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
  })
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
        className={`${strong ? 'text-base font-bold' : 'font-semibold'} ${valueClass}`}
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
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className={cardClass} style={pad(16)}>
      <p className="text-sm text-ink-400">{label}</p>
      <p
        dir="ltr"
        className={`text-right text-xl font-bold ${valueClass}`}
        style={{ marginTop: 6 }}
      >
        {value}
      </p>
    </div>
  )
}

function InvoiceCard({
  invoice,
  branchName,
}: {
  invoice: Invoice
  branchName: string
}) {
  const [open, setOpen] = useState(false)
  const jobExpenses = jobExpensesOf(invoice)
  const workCost = workCostOf(invoice)
  const net = netOf(invoice)
  const when = new Date(invoice.created_at)

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between text-start"
        style={{ ...pad(16, 20), gap: 12 }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <span className="font-bold">فاتورة #{invoice.invoice_no}</span>
            <span
              className="rounded-full bg-ink-800 text-xs font-semibold text-ink-100"
              style={pad(2, 10)}
            >
              {branchName}
            </span>
          </div>
          <p className="truncate font-semibold" style={{ marginTop: 6 }}>
            {invoice.customer_name}
          </p>
          <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
            {[invoice.car_model, invoice.plate_number]
              .filter(Boolean)
              .join(' • ') || 'من غير بيانات عربية'}
          </p>
          <p className="text-xs text-ink-400" style={{ marginTop: 6 }}>
            {format(when, 'd MMMM yyyy', { locale: ar })} •{' '}
            <span dir="ltr">{timeLabel(invoice.created_at)}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center" style={{ gap: 4 }}>
          <span dir="ltr" className="font-bold">
            {money(invoice.total_price)}
          </span>
          {open ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
        </div>
      </button>

      {open && (
        <div
          className="flex flex-col border-t border-ink-700 text-sm"
          style={{ ...pad(16, 20), gap: 16 }}
        >
          <div className="flex flex-col" style={{ gap: 8 }}>
            <p className="font-bold">مين عمل إيه</p>
            {invoice.work.length === 0 && (
              <p className="text-ink-400">مفيش شغل متسجل.</p>
            )}
            {invoice.work.map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{ gap: 12 }}
              >
                <span>
                  {w.employee}{' '}
                  <span className="text-ink-400">
                    — {SECTION_LABEL[w.section] ?? w.section}
                  </span>
                </span>
                <span dir="ltr" className="font-semibold">
                  {money(w.rate)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col" style={{ gap: 8 }}>
            <p className="font-bold">مصروفات الشغل</p>
            {invoice.expenses.length === 0 && (
              <p className="text-ink-400">مفيش مصروفات.</p>
            )}
            {invoice.expenses.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{ gap: 12 }}
              >
                <span>{e.description}</span>
                <span dir="ltr" className="font-semibold">
                  {money(e.amount)}
                </span>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col border-t border-ink-700"
            style={{ paddingTop: 12, gap: 8 }}
          >
            <Line label="سعر الفاتورة" value={invoice.total_price} />
            <Line label="مصروفات الشغل" value={jobExpenses} />
            <Line label="نسب الموظفين" value={workCost} />
            <Line
              label="صافي العملية"
              value={net}
              strong
              valueClass={tone(net)}
            />
          </div>

          {(invoice.customer_phone || invoice.notes) && (
            <div className="flex flex-col text-ink-400" style={{ gap: 4 }}>
              {invoice.customer_phone && (
                <p>
                  تليفون العميل:{' '}
                  <span dir="ltr" className="text-ink-100">
                    {invoice.customer_phone}
                  </span>
                </p>
              )}
              {invoice.notes && <p>ملاحظات: {invoice.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- الصفحة ----------

export default function Operations() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState(() => new Date())
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { from, to } = getRange(period, anchor)
  const includesToday = isWithinInterval(new Date(), { start: from, end: to })

  const branchesQuery = useQuery({
    queryKey: ['branches-list'],
    queryFn: fetchBranches,
  })

  const invoicesQuery = useQuery({
    queryKey: ['operations', format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
    queryFn: () => fetchInvoices(from, to),
  })

  const branches = branchesQuery.data ?? []
  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? '—'

  const term = search.trim().toLowerCase()
  const invoices = (invoicesQuery.data ?? []).filter((inv) => {
    if (branchFilter !== 'all' && inv.branch_id !== branchFilter) return false
    if (!term) return true
    return [
      inv.customer_name,
      inv.plate_number ?? '',
      inv.car_model ?? '',
      String(inv.invoice_no),
    ].some((v) => v.toLowerCase().includes(term))
  })

  const revenue = round2(invoices.reduce((s, i) => s + i.total_price, 0))
  const jobExpenses = round2(invoices.reduce((s, i) => s + jobExpensesOf(i), 0))
  const workCost = round2(invoices.reduce((s, i) => s + workCostOf(i), 0))
  const net = round2(revenue - jobExpenses - workCost)

  const navBtnClass =
    'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
    'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border text-sm font-semibold transition ${
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-ink-100'
    }`

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">العمليات</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          كل الفواتير في الفروع: مين عمل إيه، والمصروفات، وصافي كل عملية.
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

      {/* فلتر الفرع + البحث */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <button
            type="button"
            onClick={() => setBranchFilter('all')}
            className={chip(branchFilter === 'all')}
            style={pad(6, 16)}
          >
            كل الفروع
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchFilter(b.id)}
              className={chip(branchFilter === b.id)}
              style={pad(6, 16)}
            >
              {b.name}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم العميل أو رقم العربية أو رقم الفاتورة"
          className={`${inputClass} sm:max-w-md`}
          style={pad(12, 16)}
        />
      </div>

      {invoicesQuery.isLoading && <p className="text-ink-400">جاري التحميل...</p>}

      {(invoicesQuery.error || branchesQuery.error) && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل العمليات. اتأكد إنك داخل بحساب المناجر وإن ملفات الـ SQL
          اتشغلت.
        </p>
      )}

      {invoicesQuery.data && (
        <>
          <section
            className="grid grid-cols-2 lg:grid-cols-4"
            style={{ gap: 12 }}
          >
            <Stat label="عدد العمليات" value={String(invoices.length)} />
            <Stat
              label="الإيرادات"
              value={money(revenue)}
              valueClass="text-emerald-400"
            />
            <Stat label="مصروفات الشغل" value={money(jobExpenses)} />
            <Stat
              label="الصافي بعد نسب الموظفين"
              value={money(net)}
              valueClass={tone(net)}
            />
          </section>

          {invoices.length === 0 ? (
            <p className="text-ink-400">مفيش عمليات في الفترة دي.</p>
          ) : (
            <section className="flex flex-col" style={{ gap: 12 }}>
              {invoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  branchName={branchName(inv.branch_id)}
                />
              ))}
            </section>
          )}

          <p className="text-xs text-ink-400">
            صافي العملية = سعر الفاتورة − مصروفات الشغل − نسب الموظفين. ده من غير
            اليوميات والمصروفات العامة، اللي بتظهر في الملخصات المالية.
          </p>
        </>
      )}
    </div>
  )
}
