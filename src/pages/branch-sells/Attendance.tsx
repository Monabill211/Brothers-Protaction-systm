import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'

type Employee = {
  id: string
  full_name: string
  daily_rate: number
  is_active: boolean
}

type AttendanceRow = {
  id: string
  employee_id: string
  check_in: string | null
  check_out: string | null
}

type Status = 'unrecorded' | 'present' | 'left' | 'absent'

type Action = 'present' | 'absent' | 'checkout' | 'undo-checkout'

const TZ = 'Africa/Cairo'

// تاريخ النهارده بتوقيت مصر (YYYY-MM-DD)، نفس اللي قاعدة البيانات بتعتمد عليه
function cairoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusOf(row: AttendanceRow | undefined): Status {
  if (!row) return 'unrecorded'
  if (!row.check_in) return 'absent'
  if (row.check_out) return 'left'
  return 'present'
}

const STATUS_UI: Record<Status, { label: string; chip: string }> = {
  unrecorded: { label: 'لسه ما اتسجلش', chip: 'bg-ink-800 text-ink-400' },
  present: { label: 'حاضر', chip: 'bg-emerald-500/15 text-emerald-400' },
  left: { label: 'انصرف', chip: 'bg-sky-500/15 text-sky-300' },
  absent: { label: 'غايب', chip: 'bg-brand-600/20 text-brand-400' },
}

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const primaryBtnClass =
  'flex flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'flex flex-1 items-center justify-center rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60'

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

async function fetchToday(day: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, employee_id, check_in, check_out')
    .eq('work_date', day)
  if (error) throw error
  return (data ?? []) as AttendanceRow[]
}

// ---------- كارت الموظف ----------

function EmployeeCard({
  employee,
  row,
  busy,
  onAction,
}: {
  employee: Employee
  row: AttendanceRow | undefined
  busy: boolean
  onAction: (action: Action) => void
}) {
  const status = statusOf(row)
  const ui = STATUS_UI[status]

  return (
    <div
      className={`${cardClass} flex flex-col`}
      style={{ ...pad(20), gap: 14 }}
    >
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{employee.full_name}</h3>
          {row?.check_in && (
            <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
              حضر الساعة{' '}
              <span dir="ltr" className="font-semibold text-ink-100">
                {timeLabel(row.check_in)}
              </span>
              {row.check_out && (
                <>
                  {' '}
                  وانصرف الساعة{' '}
                  <span dir="ltr" className="font-semibold text-ink-100">
                    {timeLabel(row.check_out)}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full text-xs font-semibold ${ui.chip}`}
          style={pad(4, 12)}
        >
          {ui.label}
        </span>
      </div>

      <div className="flex" style={{ gap: 8 }}>
        {status === 'unrecorded' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('present')}
              className={primaryBtnClass}
              style={pad(12, 16)}
            >
              حضور
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('absent')}
              className={ghostBtnClass}
              style={pad(12, 16)}
            >
              غياب
            </button>
          </>
        )}

        {status === 'present' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('checkout')}
              className={primaryBtnClass}
              style={pad(12, 16)}
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('absent')}
              className={ghostBtnClass}
              style={pad(12, 16)}
            >
              غياب
            </button>
          </>
        )}

        {status === 'left' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('undo-checkout')}
              className={ghostBtnClass}
              style={pad(12, 16)}
            >
              إلغاء الانصراف
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('absent')}
              className={ghostBtnClass}
              style={pad(12, 16)}
            >
              غياب
            </button>
          </>
        )}

        {status === 'absent' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('present')}
            className={primaryBtnClass}
            style={pad(12, 16)}
          >
            تسجيل حضور
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- الصفحة ----------

export default function Attendance() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const branchId = profile?.branch_id ?? null
  const today = cairoToday()

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
  })
  const attendanceQuery = useQuery({
    queryKey: ['attendance', today],
    queryFn: () => fetchToday(today),
    enabled: !!branchId,
  })

  const employees = (employeesQuery.data ?? []).filter((e) => e.is_active)
  const rows = attendanceQuery.data ?? []
  const rowOf = (employeeId: string) =>
    rows.find((r) => r.employee_id === employeeId)

  const counts = employees.reduce(
    (acc, e) => {
      const s = statusOf(rowOf(e.id))
      if (s === 'present' || s === 'left') acc.present += 1
      else if (s === 'absent') acc.absent += 1
      else acc.unrecorded += 1
      return acc
    },
    { present: 0, absent: 0, unrecorded: 0 }
  )

  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['attendance'] })

  const onError = (e: unknown) => {
    console.error(e)
    toast.error('مقدرتش أسجل. اتأكد إنك داخل بحساب السيلز وإن ملف 06 اتشغّل')
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      employee,
      action,
    }: {
      employee: Employee
      action: Action
    }) => {
      const row = rowOf(employee.id)
      const now = new Date().toISOString()

      if (action === 'checkout' || action === 'undo-checkout') {
        if (!row) throw new Error('no attendance row')
        const { error } = await supabase
          .from('attendance')
          .update({ check_out: action === 'checkout' ? now : null })
          .eq('id', row.id)
        if (error) throw error
        return
      }

      const { error } = await supabase.from('attendance').upsert(
        {
          branch_id: branchId,
          employee_id: employee.id,
          work_date: today,
          check_in: action === 'present' ? now : null,
          check_out: null,
        },
        { onConflict: 'employee_id,work_date' }
      )
      if (error) throw error
    },
    onMutate: ({ employee }) => setBusyId(employee.id),
    onSettled: () => setBusyId(null),
    onSuccess: refresh,
    onError,
  })

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      const pending = employees.filter((e) => !rowOf(e.id))
      if (pending.length === 0) return
      const { error } = await supabase.from('attendance').upsert(
        pending.map((e) => ({
          branch_id: branchId,
          employee_id: e.id,
          work_date: today,
          check_in: now,
          check_out: null,
        })),
        { onConflict: 'employee_id,work_date' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تسجيل حضور الباقي')
      refresh()
    },
    onError,
  })

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">الحضور والانصراف</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي للسيلز بس. ادخل بحساب سيلز عشان تسجل الحضور.
        </p>
      )}

      {(employeesQuery.error || attendanceQuery.error) && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل الحضور. اتأكد إنك داخل بحساب سيلز وإن ملفات الـ SQL
          اتشغلت.
        </p>
      )}

      {branchId && employeesQuery.data && employees.length === 0 && (
        <p className="text-ink-400">
          مفيش موظفين شغّالين في الفرع. مدير الفرع لازم يضيفهم الأول من صفحة
          الموظفين.
        </p>
      )}

      {branchId && employees.length > 0 && attendanceQuery.data && (
        <>
          {/* ملخص النهارده */}
          <section className="grid grid-cols-3" style={{ gap: 12 }}>
            <div
              className={`${cardClass} text-center`}
              style={pad(14, 8)}
            >
              <p className="text-2xl font-bold text-emerald-400">
                {counts.present}
              </p>
              <p className="text-xs text-ink-400">حاضر</p>
            </div>
            <div
              className={`${cardClass} text-center`}
              style={pad(14, 8)}
            >
              <p className="text-2xl font-bold text-brand-400">
                {counts.absent}
              </p>
              <p className="text-xs text-ink-400">غايب</p>
            </div>
            <div
              className={`${cardClass} text-center`}
              style={pad(14, 8)}
            >
              <p className="text-2xl font-bold">{counts.unrecorded}</p>
              <p className="text-xs text-ink-400">لسه ما اتسجلش</p>
            </div>
          </section>

          {counts.unrecorded > 0 && (
            <button
              type="button"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
              className={`${primaryBtnClass} sm:max-w-xs`}
              style={pad(12, 20)}
            >
              {bulkMutation.isPending
                ? 'جاري التسجيل...'
                : `حضور للباقي (${counts.unrecorded})`}
            </button>
          )}

          <section className="grid md:grid-cols-2" style={{ gap: 16 }}>
            {employees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                row={rowOf(employee.id)}
                busy={busyId === employee.id || bulkMutation.isPending}
                onAction={(action) =>
                  actionMutation.mutate({ employee, action })
                }
              />
            ))}
          </section>

          <p className="text-xs text-ink-400">
            اليوم بيتحسب في القبض لو الموظف اتسجل له حضور. تعديل الأيام القديمة
            عند مدير الفرع.{' '}
            <Link to="/branch-sells" className="text-brand-400 underline">
              الرجوع للرئيسية
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
