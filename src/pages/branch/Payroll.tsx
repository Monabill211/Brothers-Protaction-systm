import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addWeeks,
  endOfWeek,
  format,
  isWithinInterval,
  startOfWeek,
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  MdCheckCircle,
  MdChevronLeft,
  MdChevronRight,
  MdPrint,
} from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import { SECTION_LABEL, SECTION_ORDER, type Section } from '../../lib/sections'

type Employee = {
  id: string
  full_name: string
  daily_rate: number
  is_active: boolean
}

type WorkLine = {
  section: Section
  label: string
  rate: number
  count: number
  amount: number
}

type Slip = {
  employee: Employee
  dailyRate: number
  days: number
  daysAmount: number
  workLines: WorkLine[]
  workAmount: number
  total: number
}

type AttendanceRow = {
  employee_id: string
  work_date: string
  check_in: string | null
}
type WorkRow = { employee_id: string; section: Section; rate: number }
type RunRow = {
  employee_id: string
  days_worked: number
  days_amount: number
  work_amount: number
  total_amount: number
  details: { daily_rate?: number; work?: WorkLine[] } | null
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

// ---------- الداتا ----------

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

async function fetchWeek(branchId: string, from: Date, to: Date) {
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')

  const [att, work, runs, branch] = await Promise.all([
    supabase
      .from('attendance')
      .select('employee_id, work_date, check_in')
      .gte('work_date', fromStr)
      .lte('work_date', toStr),
    supabase
      .from('invoice_work')
      .select('employee_id, section, rate')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString()),
    supabase
      .from('payroll_runs')
      .select(
        'employee_id, days_worked, days_amount, work_amount, total_amount, details'
      )
      .eq('week_start', fromStr),
    supabase.from('branches').select('name').eq('id', branchId).maybeSingle(),
  ])

  if (att.error) throw att.error
  if (work.error) throw work.error
  if (runs.error) throw runs.error

  return {
    attendance: (att.data ?? []) as AttendanceRow[],
    work: (work.data ?? []).map((w) => ({
      employee_id: w.employee_id as string,
      section: w.section as Section,
      rate: Number(w.rate),
    })) as WorkRow[],
    runs: (runs.data ?? []).map((r) => ({
      employee_id: r.employee_id as string,
      days_worked: Number(r.days_worked),
      days_amount: Number(r.days_amount),
      work_amount: Number(r.work_amount),
      total_amount: Number(r.total_amount),
      details: r.details as RunRow['details'],
    })) as RunRow[],
    branchName: (branch.data?.name as string | undefined) ?? '',
  }
}

// ---------- الحساب ----------

function buildSlip(
  emp: Employee,
  attendance: AttendanceRow[],
  work: WorkRow[]
): Slip {
  // اليوم بيتحسب لو الموظف اتسجل له حضور
  const days = new Set(
    attendance
      .filter((a) => a.employee_id === emp.id && a.check_in)
      .map((a) => a.work_date)
  ).size

  const grouped = new Map<string, WorkLine>()
  for (const w of work) {
    if (w.employee_id !== emp.id) continue
    const key = `${w.section}|${w.rate}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
      existing.amount = round2(existing.amount + w.rate)
    } else {
      grouped.set(key, {
        section: w.section,
        label: SECTION_LABEL[w.section] ?? w.section,
        rate: w.rate,
        count: 1,
        amount: w.rate,
      })
    }
  }

  const workLines = [...grouped.values()].sort(
    (a, b) =>
      SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) ||
      a.rate - b.rate
  )

  const daysAmount = round2(days * emp.daily_rate)
  const workAmount = round2(workLines.reduce((sum, l) => sum + l.amount, 0))

  return {
    employee: emp,
    dailyRate: emp.daily_rate,
    days,
    daysAmount,
    workLines,
    workAmount,
    total: round2(daysAmount + workAmount),
  }
}

function slipFromRun(emp: Employee, run: RunRow): Slip {
  return {
    employee: emp,
    dailyRate: Number(run.details?.daily_rate ?? emp.daily_rate),
    days: run.days_worked,
    daysAmount: run.days_amount,
    workLines: (run.details?.work ?? []).map((l) => ({
      ...l,
      rate: Number(l.rate),
      count: Number(l.count),
      amount: Number(l.amount),
    })),
    workAmount: run.work_amount,
    total: run.total_amount,
  }
}

// ---------- الطباعة / PDF ----------

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

function slipHtml(s: Slip, branchName: string, period: string) {
  const workRows = s.workLines.length
    ? s.workLines
        .map(
          (l) =>
            `<tr><td>${esc(l.label)}</td><td>${l.count}</td><td dir="ltr">${num(
              l.rate
            )}</td><td dir="ltr">${num(l.amount)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="muted">مفيش شغل متسجل في الأسبوع ده</td></tr>'

  return `
  <section class="page">
    <header>
      <div>
        <h1>Brothers Car Protection</h1>
        <p class="muted">${esc(branchName)}</p>
      </div>
      <div class="period">
        <strong>كشف قبض أسبوعي</strong>
        <p class="muted">${esc(period)}</p>
      </div>
    </header>

    <h2>الموظف: ${esc(s.employee.full_name)}</h2>

    <h3>الحضور</h3>
    <table>
      <thead><tr><th>عدد الأيام</th><th>اليومية</th><th>المبلغ</th></tr></thead>
      <tbody><tr><td>${s.days}</td><td dir="ltr">${num(s.dailyRate)}</td><td dir="ltr">${num(
        s.daysAmount
      )}</td></tr></tbody>
    </table>

    <h3>الشغل</h3>
    <table>
      <thead><tr><th>الجزء</th><th>العدد</th><th>النسبة</th><th>المبلغ</th></tr></thead>
      <tbody>${workRows}</tbody>
      <tfoot><tr><td colspan="3">إجمالي الشغل</td><td dir="ltr">${num(
        s.workAmount
      )}</td></tr></tfoot>
    </table>

    <div class="total">
      <span>الإجمالي المستحق</span>
      <strong dir="ltr">${num(s.total)} ج.م</strong>
    </div>

    <div class="sign">
      <span>توقيع الموظف: ________________</span>
      <span>توقيع المسؤول: ________________</span>
    </div>
  </section>`
}

function printSlips(slips: Slip[], branchName: string, period: string) {
  const win = window.open('', '_blank')
  if (!win) {
    toast.error('المتصفح منع النافذة. اسمح بالـ pop-ups للموقع وجرّب تاني')
    return
  }

  const doc = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>كشف قبض - ${esc(period)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; color: #111; margin: 0; }
  .page { page-break-after: always; padding: 8px; }
  .page:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 3px solid #c8102e; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 22px; color: #c8102e; }
  h2 { font-size: 20px; margin: 0 0 16px; }
  h3 { font-size: 15px; margin: 18px 0 8px; }
  p { margin: 4px 0 0; }
  .muted { color: #666; font-size: 13px; }
  .period { text-align: left; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
  th { background: #f3f3f3; }
  tfoot td { font-weight: bold; background: #fafafa; }
  .total { display: flex; justify-content: space-between; align-items: center;
           margin-top: 22px; padding: 14px 16px; border: 2px solid #111; font-size: 18px; }
  .sign { display: flex; justify-content: space-between; margin-top: 60px; font-size: 14px; }
</style>
</head>
<body>
${slips.map((s) => slipHtml(s, branchName, period)).join('')}
</body>
</html>`

  win.document.open()
  win.document.write(doc)
  win.document.close()
  win.focus()
  // بعد ما يتفتح اختار "Save as PDF" من نافذة الطباعة
  setTimeout(() => win.print(), 400)
}

// ---------- مكونات صغيرة ----------

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12 }}>
      <span className={strong ? 'font-bold' : 'text-ink-400'}>{label}</span>
      <span
        dir="ltr"
        className={strong ? 'text-lg font-bold' : 'font-semibold'}
      >
        {money(value)}
      </span>
    </div>
  )
}

function SlipCard({
  slip,
  approved,
  changed,
  approving,
  onApprove,
  onPrint,
}: {
  slip: Slip
  approved: boolean
  changed: boolean
  approving: boolean
  onApprove: () => void
  onPrint: () => void
}) {
  return (
    <div
      className={`${cardClass} flex flex-col ${
        slip.employee.is_active ? '' : 'opacity-70'
      }`}
      style={{ ...pad(20), gap: 14 }}
    >
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <h3 className="min-w-0 truncate text-lg font-bold">
          {slip.employee.full_name}
        </h3>
        <span
          className={`shrink-0 rounded-full text-xs font-semibold ${
            approved
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-ink-800 text-ink-400'
          }`}
          style={pad(4, 12)}
        >
          {approved ? 'معتمد' : 'لسه مش معتمد'}
        </span>
      </div>

      <div className="flex flex-col text-sm" style={{ gap: 8 }}>
        <Row
          label={`الحضور (${slip.days} يوم × ${money(slip.dailyRate)})`}
          value={slip.daysAmount}
        />
        {slip.workLines.map((l) => (
          <Row
            key={`${l.section}-${l.rate}`}
            label={`${l.label} (${l.count} × ${money(l.rate)})`}
            value={l.amount}
          />
        ))}
        {slip.workLines.length === 0 && (
          <p className="text-ink-400">مفيش شغل متسجل الأسبوع ده.</p>
        )}

        <div className="border-t border-ink-700" style={{ marginTop: 4 }} />
        <Row label="الإجمالي" value={slip.total} strong />
      </div>

      {changed && (
        <p
          className="rounded-lg bg-amber-500/10 text-xs text-amber-300"
          style={pad(10, 12)}
        >
          فيه تغييرات اتسجلت بعد الاعتماد. دوس &quot;تحديث الاعتماد&quot; تحت
          عشان الأرقام تتحدّث.
        </p>
      )}

      <div className="flex" style={{ gap: 8 }}>
        {(!approved || changed) && (
          <button
            type="button"
            disabled={approving}
            onClick={onApprove}
            className={`${primaryBtnClass} flex-1`}
            style={{ ...pad(10, 16), gap: 6 }}
          >
            <MdCheckCircle size={18} />
            {approving
              ? 'جاري الاعتماد...'
              : approved
                ? 'تحديث الاعتماد'
                : 'اعتماد القبض'}
          </button>
        )}
        <button
          type="button"
          onClick={onPrint}
          className={`${ghostBtnClass} flex-1`}
          style={{ ...pad(10, 16), gap: 6 }}
        >
          <MdPrint size={18} />
          طباعة / PDF
        </button>
      </div>
    </div>
  )
}

// ---------- الصفحة ----------

export default function Payroll() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [anchor, setAnchor] = useState(() => new Date())

  const branchId = profile?.branch_id ?? null

  // الأسبوع بيبدأ السبت وبينتهي الجمعة
  const from = startOfWeek(anchor, { weekStartsOn: 6 })
  const to = endOfWeek(anchor, { weekStartsOn: 6 })
  const fromStr = format(from, 'yyyy-MM-dd')
  const toStr = format(to, 'yyyy-MM-dd')
  const includesToday = isWithinInterval(new Date(), { start: from, end: to })
  const period = `من ${format(from, 'd MMMM', { locale: ar })} إلى ${format(
    to,
    'd MMMM yyyy',
    { locale: ar }
  )}`

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
  })

  const weekQuery = useQuery({
    queryKey: ['payroll-week', branchId, fromStr],
    queryFn: () => fetchWeek(branchId as string, from, to),
    enabled: !!branchId,
  })

  const employees = employeesQuery.data ?? []
  const week = weekQuery.data

  // لكل موظف: الأرقام الحية + الأرقام المعتمدة (لو اتعمل اعتماد)
  const items = week
    ? employees
        .map((emp) => {
          const live = buildSlip(emp, week.attendance, week.work)
          const run = week.runs.find((r) => r.employee_id === emp.id)
          const saved = run ? slipFromRun(emp, run) : null
          return {
            live,
            saved,
            slip: saved ?? live,
            changed: !!saved && Math.abs(saved.total - live.total) > 0.005,
          }
        })
        .filter((i) => i.slip.employee.is_active || i.slip.total > 0 || i.saved)
    : []

  const grandTotal = round2(items.reduce((sum, i) => sum + i.slip.total, 0))
  const approvedCount = items.filter((i) => i.saved).length
  // الموظف اللي بيتعتمد دلوقتي (عشان نقفل زرار الكارت بتاعه بس)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // اعتماد موظف واحد في المرة
  const approveMutation = useMutation({
    mutationFn: async (live: Slip) => {
      const { error } = await supabase.from('payroll_runs').upsert(
        {
          branch_id: branchId,
          employee_id: live.employee.id,
          week_start: fromStr,
          week_end: toStr,
          days_worked: live.days,
          days_amount: live.daysAmount,
          work_amount: live.workAmount,
          details: { daily_rate: live.dailyRate, work: live.workLines },
        },
        { onConflict: 'employee_id,week_start' }
      )
      if (error) throw error
    },
    onMutate: (live) => setApprovingId(live.employee.id),
    onSettled: () => setApprovingId(null),
    onSuccess: (_data, live) => {
      toast.success(`تم اعتماد ${live.employee.full_name}`)
      queryClient.invalidateQueries({ queryKey: ['payroll-week'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error('مقدرتش أعتمد القبض. اتأكد إنك داخل بحساب مدير الفرع')
    },
  })

  const navBtnClass =
    'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
    'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">القبض الأسبوعي</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          حضور وشغل كل موظف في الأسبوع، واعتماد القبض وطباعة الكشف.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي لمدير الفرع بس. ادخل بحساب مدير فرع عشان تشوف القبض.
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

      {(employeesQuery.isLoading || weekQuery.isLoading) && branchId && (
        <p className="text-ink-400">جاري التحميل...</p>
      )}

      {(employeesQuery.error || weekQuery.error) && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل القبض. اتأكد إنك داخل بحساب مدير الفرع وإن ملفات الـ SQL
          اتشغلت.
        </p>
      )}

      {week && employees.length === 0 && (
        <p className="text-ink-400">
          لسه مفيش موظفين.{' '}
          <Link to="/branch/employees" className="text-brand-400 underline">
            ضيف الموظفين الأول
          </Link>
        </p>
      )}

      {week && items.length > 0 && (
        <>
          {/* الإجمالي والأزرار */}
          <section
            className={`${cardClass} flex flex-col sm:flex-row sm:items-center sm:justify-between`}
            style={{ ...pad(20), gap: 16 }}
          >
            <div>
              <p className="text-sm text-ink-400">إجمالي قبض الأسبوع</p>
              <p
                dir="ltr"
                className="text-right text-2xl font-bold"
                style={{ marginTop: 4 }}
              >
                {money(grandTotal)}
              </p>
              <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
                معتمد {approvedCount} من {items.length}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() =>
                  printSlips(
                    items.map((i) => i.slip),
                    week.branchName,
                    period
                  )
                }
                className={ghostBtnClass}
                style={{ ...pad(12, 20), gap: 6 }}
              >
                <MdPrint size={20} />
                طباعة الكل
              </button>
            </div>
          </section>

          {/* كارت لكل موظف */}
          <section className="grid md:grid-cols-2" style={{ gap: 16 }}>
            {items.map((i) => (
              <SlipCard
                key={i.slip.employee.id}
                slip={i.slip}
                approved={!!i.saved}
                changed={i.changed}
                approving={approvingId === i.slip.employee.id}
                onApprove={() => approveMutation.mutate(i.live)}
                onPrint={() => printSlips([i.slip], week.branchName, period)}
              />
            ))}
          </section>

          <p className="text-xs text-ink-400">
            الحضور بيتحسب من تسجيل السيلز للموظفين، والشغل من الفواتير. اعتمد
            كل موظف لوحده من الكارت بتاعه، وبعد الاعتماد الأرقام بتتثبّت وبتظهر
            في الملخصات المالية بتاعت الاونر. في نافذة الطباعة اختار
            &quot;Save as PDF&quot; عشان تطلع ملف PDF.
          </p>
        </>
      )}
    </div>
  )
}
