import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { addWeeks, format, isWithinInterval } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  MdChevronLeft,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
  MdNotificationsActive,
} from 'react-icons/md'
import { useAuth } from '../../auth/auth-context'
import { money } from '../../lib/format'
import {
  fetchWeekServiceAlerts,
  weekKey,
  weekServiceWindow,
  type ServiceAlert,
} from '../../lib/serviceAlerts'
import { rangeLabel } from '../../lib/periods'
import { SECTION_LABEL } from '../../lib/sections'
import { centerX, pad } from '../../lib/spacing'

const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const navBtnClass =
  'rounded-lg border border-ink-700 bg-ink-900 text-ink-100 transition ' +
  'hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40'

function phoneHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`
}

function AlertCard({ alert }: { alert: ServiceAlert }) {
  const [open, setOpen] = useState(false)
  const serviceDate = new Date(alert.created_at)
  const car = [alert.car_model, alert.car_year, alert.car_color, alert.plate_number]
    .filter(Boolean)
    .join(' • ')

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
          <p className="truncate text-lg font-bold">{alert.customer_name}</p>
          <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
            فاتورة #{alert.invoice_no}
            {alert.kind === 'manual' ? ' • عادية' : ' • حماية'}
          </p>
          <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
            الخدمة:{' '}
            {format(serviceDate, 'd MMMM yyyy', { locale: ar })}
          </p>
        </div>

        <div className="flex shrink-0 items-center" style={{ gap: 8 }}>
          <span dir="ltr" className="font-bold">
            {money(alert.total_price)}
          </span>
          {open ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
        </div>
      </button>

      {open && (
        <div
          className="flex flex-col border-t border-ink-700 text-sm"
          style={{ ...pad(16, 20), gap: 12 }}
        >
          {alert.customer_phone ? (
            <p>
              التليفون:{' '}
              <a
                href={phoneHref(alert.customer_phone)}
                dir="ltr"
                className="font-semibold text-brand-400 hover:underline"
              >
                {alert.customer_phone}
              </a>
            </p>
          ) : (
            <p className="text-ink-400">من غير رقم تليفون</p>
          )}

          {car && (
            <p className="text-ink-400">
              العربية: <span className="text-ink-100">{car}</span>
            </p>
          )}

          {alert.lines.length > 0 && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              <p className="font-bold">الخدمات</p>
              {alert.lines.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between"
                  style={{ gap: 12 }}
                >
                  <span>{l.description}</span>
                  <span dir="ltr" className="font-semibold">
                    {money(l.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {alert.sections.length > 0 && (
            <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
              <span className="text-ink-400">الشغل:</span>
              {alert.sections.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-brand-600/15 text-xs font-semibold text-brand-400"
                  style={pad(2, 10)}
                >
                  {SECTION_LABEL[s] ?? s}
                </span>
              ))}
            </div>
          )}

          {alert.notes && (
            <p className="text-ink-400">
              ملاحظات: <span className="text-ink-100">{alert.notes}</span>
            </p>
          )}

          <p className="text-ink-400">
            إجمالي الفاتورة:{' '}
            <span dir="ltr" className="font-bold text-ink-100">
              {money(alert.total_price)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

export function WeeklyAlertsPreview() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null
  const alertsPath =
    profile?.role === 'branch_manager' ? '/branch/alerts' : '/branch-sells/alerts'

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-alerts', weekKey(new Date())],
    queryFn: () => fetchWeekServiceAlerts(new Date()),
    enabled: !!branchId,
  })

  if (!branchId) return null

  const count = data?.length ?? 0
  const preview = (data ?? []).slice(0, 4)

  return (
    <section className={`${cardClass} border-brand-700/50`}>
      <div
        className="flex items-start justify-between"
        style={{ ...pad(20), gap: 12 }}
      >
        <div className="flex min-w-0 items-start" style={{ gap: 12 }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-600/15 text-brand-500">
            <MdNotificationsActive size={26} />
          </span>
          <div className="min-w-0">
            <p className="font-bold">تنبيهات المتابعة</p>
            <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
              عملاء عدى على خدمتهم 3 شهور الأسبوع ده.
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full bg-brand-600 text-sm font-bold text-white"
          style={pad(4, 12)}
        >
          {isLoading ? '…' : count}
        </span>
      </div>

      <div
        className="flex flex-col border-t border-ink-700"
        style={{ ...pad(16, 20), gap: 10 }}
      >
        {error && (
          <p className="text-sm text-brand-400">مقدرتش أحمّل التنبيهات.</p>
        )}

        {!isLoading && !error && count === 0 && (
          <p className="text-sm text-ink-400">
            مفيش عملاء وصلوا لـ 3 شهور على الخدمة الأسبوع ده.
          </p>
        )}

        {preview.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between"
            style={{ gap: 12 }}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{a.customer_name}</p>
              <p className="text-xs text-ink-400">فاتورة #{a.invoice_no}</p>
            </div>
            {a.customer_phone && (
              <span dir="ltr" className="shrink-0 text-sm text-ink-400">
                {a.customer_phone}
              </span>
            )}
          </div>
        ))}

        <Link
          to={alertsPath}
          className="text-sm font-semibold text-brand-400 hover:underline"
          style={{ marginTop: 4 }}
        >
          {count > 4 ? `عرض الكل (${count})` : 'فتح التنبيهات والتفاصيل'}
        </Link>
      </div>
    </section>
  )
}

export default function Alerts() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null
  const [anchor, setAnchor] = useState(() => new Date())

  const { weekFrom, weekTo } = weekServiceWindow(anchor)
  const includesToday = isWithinInterval(new Date(), {
    start: weekFrom,
    end: weekTo,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-alerts', weekKey(anchor)],
    queryFn: () => fetchWeekServiceAlerts(anchor),
    enabled: !!branchId,
  })

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">تنبيهات المتابعة</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          كل أسبوع بيظهر العملاء اللي عدى على خدمتهم 3 شهور. اضغط على الفاتورة
          عشان تشوف التفاصيل وتتواصل مع العميل.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي لمدير الفرع والسيلز. ادخل بحساب فرع عشان تشوف التنبيهات.
        </p>
      )}

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
          <p className="font-bold">{rangeLabel('week', weekFrom, weekTo)}</p>
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
          onClick={() => setAnchor((a) => addWeeks(a, 1))}
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
          مقدرتش أحمّل التنبيهات. اتأكد إنك داخل بحساب مدير فرع أو سيلز.
        </p>
      )}

      {data && (
        <section className="flex flex-col" style={{ gap: 12 }}>
          <h2 className="font-bold">
            {data.length === 0
              ? 'مفيش تنبيهات في الأسبوع ده'
              : `${data.length} عميل محتاج متابعة`}
          </h2>

          {data.length === 0 ? (
            <p className="text-ink-400">
              مفيش فواتير عدى عليها 3 شهور في الأسبوع ده. لو حابب شوف أسبوع
              سابق.
            </p>
          ) : (
            data.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          )}
        </section>
      )}
    </div>
  )
}
