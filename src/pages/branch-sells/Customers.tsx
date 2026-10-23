import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { MdExpandLess, MdExpandMore, MdSearch } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'

type Customer = {
  id: string
  name: string
  phone: string | null
  invoices_count: number
}

type CustomerInvoice = {
  id: string
  invoice_no: number
  car_model: string | null
  plate_number: string | null
  total_price: number
  notes: string | null
  created_at: string
  sections: string[]
}

const SECTION_LABEL: Record<string, string> = {
  front: 'الوش',
  back: 'الضهر',
  side_one: 'جنب واحد',
  side_two: 'جنب اتنين',
}
const SECTION_ORDER = ['front', 'back', 'side_one', 'side_two']

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-900 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

// ---------- helpers ----------

// الأرقام العربية -> إنجليزي، عشان البحث برقم التليفون يشتغل
function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

// شيل الرموز اللي بتبوّظ فلتر البحث
function cleanTerm(s: string) {
  return normalizeDigits(s).replace(/[,()%*\\"]/g, ' ').trim()
}

async function fetchCustomers(term: string): Promise<Customer[]> {
  const clean = cleanTerm(term)

  let query = supabase
    .from('customers')
    .select('id, name, phone, invoices(count)')
    .limit(30)

  if (clean) {
    query = query
      .or(`name.ilike."%${clean}%",phone.ilike."%${clean}%"`)
      .order('name', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const counts = r.invoices as { count: number }[] | undefined
    return {
      id: String(r.id),
      name: String(r.name),
      phone: (r.phone as string | null) ?? null,
      invoices_count: Number(counts?.[0]?.count ?? 0),
    }
  })
}

async function fetchCustomerInvoices(
  customerId: string
): Promise<CustomerInvoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_no, car_model, plate_number, total_price, notes, created_at, invoice_work(section)'
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const work = (r.invoice_work ?? []) as { section: string }[]
    const sections = [...new Set(work.map((w) => w.section))].sort(
      (a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)
    )
    return {
      id: String(r.id),
      invoice_no: Number(r.invoice_no),
      car_model: (r.car_model as string | null) ?? null,
      plate_number: (r.plate_number as string | null) ?? null,
      total_price: Number(r.total_price),
      notes: (r.notes as string | null) ?? null,
      created_at: String(r.created_at),
      sections,
    }
  })
}

// ---------- كارت العميل ----------

function CustomerCard({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-invoices', customer.id],
    queryFn: () => fetchCustomerInvoices(customer.id),
    enabled: open,
  })

  const total = (data ?? []).reduce((s, i) => s + i.total_price, 0)

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-start"
        style={{ ...pad(16, 20), gap: 12 }}
      >
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{customer.name}</p>
          <p className="text-sm text-ink-400" style={{ marginTop: 2 }}>
            {customer.phone ? (
              <span dir="ltr">{customer.phone}</span>
            ) : (
              'من غير رقم تليفون'
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center" style={{ gap: 8 }}>
          <span
            className="rounded-full bg-ink-800 text-xs font-semibold text-ink-100"
            style={pad(4, 12)}
          >
            {customer.invoices_count} فاتورة
          </span>
          {open ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
        </div>
      </button>

      {open && (
        <div
          className="flex flex-col border-t border-ink-700"
          style={{ ...pad(16, 20), gap: 12 }}
        >
          {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

          {error && (
            <p className="text-sm text-brand-400">
              مقدرتش أحمّل فواتير العميل.
            </p>
          )}

          {data && data.length === 0 && (
            <p className="text-ink-400">مفيش فواتير للعميل ده لسه.</p>
          )}

          {data && data.length > 0 && (
            <>
              <p className="text-sm text-ink-400">
                إجمالي اللي دفعه:{' '}
                <span dir="ltr" className="font-bold text-ink-100">
                  {money(total)}
                </span>
              </p>

              {data.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-ink-700 bg-ink-950"
                  style={pad(14, 16)}
                >
                  <div
                    className="flex items-start justify-between"
                    style={{ gap: 12 }}
                  >
                    <div className="min-w-0">
                      <p className="font-bold">فاتورة #{inv.invoice_no}</p>
                      <p
                        className="text-xs text-ink-400"
                        style={{ marginTop: 2 }}
                      >
                        {format(new Date(inv.created_at), 'EEEE d MMMM yyyy', {
                          locale: ar,
                        })}
                      </p>
                    </div>
                    <span dir="ltr" className="shrink-0 font-bold">
                      {money(inv.total_price)}
                    </span>
                  </div>

                  <div
                    className="flex flex-col text-sm"
                    style={{ marginTop: 10, gap: 6 }}
                  >
                    {(inv.car_model || inv.plate_number) && (
                      <p className="text-ink-400">
                        العربية:{' '}
                        <span className="text-ink-100">
                          {[inv.car_model, inv.plate_number]
                            .filter(Boolean)
                            .join(' • ')}
                        </span>
                      </p>
                    )}

                    {inv.sections.length > 0 && (
                      <div
                        className="flex flex-wrap items-center"
                        style={{ gap: 6 }}
                      >
                        <span className="text-ink-400">الشغل:</span>
                        {inv.sections.map((s) => (
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

                    {inv.notes && (
                      <p className="text-ink-400">
                        ملاحظات: <span className="text-ink-100">{inv.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- الصفحة ----------

export default function Customers() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null

  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  // استنى لحد ما تخلص كتابة قبل ما تبحث
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300)
    return () => clearTimeout(t)
  }, [term])

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', debounced],
    queryFn: () => fetchCustomers(debounced),
    enabled: !!branchId,
    placeholderData: keepPreviousData,
  })

  const searching = cleanTerm(debounced) !== ''

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">العملاء</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          ابحث باسم العميل أو رقم تليفونه وشوف فواتيره القديمة.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي للسيلز بس. ادخل بحساب سيلز عشان تبحث عن العملاء.
        </p>
      )}

      <div className="relative sm:max-w-xl">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="اسم العميل أو رقم التليفون"
          className={inputClass}
          style={{ ...pad(14, 16), paddingRight: 48 }}
          autoComplete="off"
        />
        <MdSearch
          size={24}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </div>

      {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

      {error && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل العملاء. اتأكد إنك داخل بحساب سيلز وإن ملفات الـ SQL
          اتشغلت.
        </p>
      )}

      {data && (
        <section className="flex flex-col" style={{ gap: 12 }}>
          <h2 className="font-bold">
            {searching ? `نتايج البحث (${data.length})` : 'آخر العملاء'}
          </h2>

          {data.length === 0 ? (
            <p className="text-ink-400">
              {searching
                ? 'مفيش عميل بالاسم أو الرقم ده في فرعك.'
                : 'لسه مفيش عملاء. العملاء بيتضافوا مع أول فاتورة.'}
            </p>
          ) : (
            data.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))
          )}

          {data.length === 30 && (
            <p className="text-xs text-ink-400">
              ظهر أول 30 نتيجة. اكتب اسم أو رقم أدق عشان تضيّق البحث.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
