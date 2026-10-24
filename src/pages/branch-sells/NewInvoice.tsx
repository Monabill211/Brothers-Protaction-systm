import { useEffect, useState, type FormEvent } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MdAdd,
  MdCheckCircle,
  MdDeleteOutline,
  MdPrint,
  MdSearch,
} from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import { cleanTerm } from '../../lib/search'
import MoneyInput from '../../components/MoneyInput'
import {
  SECTION_LABEL,
  printCustomerInvoice,
  printInternalInvoice,
  type PrintableInvoice,
} from '../../lib/printInvoice'

type Section = 'front' | 'back' | 'side_one' | 'side_two'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'front', label: SECTION_LABEL.front },
  { key: 'back', label: SECTION_LABEL.back },
  { key: 'side_one', label: SECTION_LABEL.side_one },
  { key: 'side_two', label: SECTION_LABEL.side_two },
]

type Employee = {
  id: string
  full_name: string
  daily_rate: number
  is_active: boolean
}

type Item = { id: string; name: string; quantity: number; unit: string }

type Rates = Partial<Record<Section, number>>

type CustomerHit = { id: string; name: string; phone: string | null }

type ExpenseRow = { key: string; description: string; amount: string }

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const primaryBtnClass =
  'flex items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'flex items-center justify-center rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60'

const round2 = (n: number) => Math.round(n * 100) / 100

function toNumber(value: string) {
  if (value.trim() === '') return NaN
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const newKey = () => Math.random().toString(36).slice(2)

function errorMessage(e: unknown) {
  const msg =
    e instanceof Error ? e.message : ((e as { message?: string })?.message ?? '')
  if (msg.includes('missing service rate'))
    return 'مدير الفرع لسه ماحددش نسبة بعض الأجزاء. كلّمه يحددها من الموظفين والنسب'
  if (msg.includes('below zero') || msg.includes('not enough stock'))
    return 'الكمية في المخزون مش كفاية لخصم الرول'
  if (msg.includes('customer not found')) return 'العميل مش موجود في فرعك'
  if (msg.includes('not allowed'))
    return 'الصفحة دي للسيلز بس. ادخل بحساب سيلز'
  return 'مقدرتش أحفظ الفاتورة. اتأكد إن ملف 08 اتشغّل وإنك داخل بحساب سيلز'
}

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

async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, quantity, unit')
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    quantity: Number(r.quantity),
    unit: r.unit as string,
  }))
}

async function searchCustomers(term: string): Promise<CustomerHit[]> {
  const clean = cleanTerm(term)
  if (!clean) return []

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .or(`name.ilike."%${clean}%",phone.ilike."%${clean}%"`)
    .order('name', { ascending: true })
    .limit(8)
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    phone: (r.phone as string | null) ?? null,
  }))
}

// ---------- اختيار عميل موجود ----------

function CustomerSearch({
  onPick,
}: {
  onPick: (customer: CustomerHit) => void
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300)
    return () => clearTimeout(t)
  }, [term])

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-customer-search', debounced],
    queryFn: () => searchCustomers(debounced),
    placeholderData: keepPreviousData,
  })

  const searching = cleanTerm(debounced) !== ''

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="relative">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="اسم العميل أو رقم التليفون"
          className={inputClass}
          style={{ ...pad(12, 16), paddingRight: 48 }}
          autoComplete="off"
        />
        <MdSearch
          size={22}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </div>

      {searching && isLoading && (
        <p className="text-sm text-ink-400">جاري البحث...</p>
      )}

      {searching && data && data.length === 0 && (
        <p className="text-sm text-ink-400">
          مفيش عميل بالاسم ده. اختار &quot;عميل جديد&quot; فوق.
        </p>
      )}

      {data?.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c)}
          className="flex items-center justify-between rounded-lg border border-ink-700 text-start transition hover:bg-ink-800"
          style={{ ...pad(10, 14), gap: 12 }}
        >
          <span className="min-w-0 truncate font-semibold">{c.name}</span>
          <span dir="ltr" className="shrink-0 text-sm text-ink-400">
            {c.phone ?? ''}
          </span>
        </button>
      ))}
    </div>
  )
}

// ---------- الصفحة ----------

export default function NewInvoice() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const branchId = profile?.branch_id ?? null

  // العميل
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [picked, setPicked] = useState<CustomerHit | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // العربية
  const [car, setCar] = useState('')
  const [plate, setPlate] = useState('')

  // مين عمل إيه: لكل جزء، الموظف اللي عمله ('' = مش متعمل)
  const [assign, setAssign] = useState<Record<Section, string>>({
    front: '',
    back: '',
    side_one: '',
    side_two: '',
  })

  // مصروفات الشغل
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])

  // المخزون: undefined = لسه ماتغيّرش (الافتراضي أول صنف موجود)، '' = من غير خصم
  const [itemChoice, setItemChoice] = useState<string | undefined>(undefined)
  const [itemQty, setItemQty] = useState('1')

  // السعر
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  // بعد الحفظ
  const [saved, setSaved] = useState<PrintableInvoice | null>(null)

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
    enabled: !!branchId,
  })
  const ratesQuery = useQuery({
    queryKey: ['service-rates'],
    queryFn: fetchRates,
    enabled: !!branchId,
  })
  const itemsQuery = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchItems,
    enabled: !!branchId,
  })
  const branchQuery = useQuery({
    queryKey: ['my-branch', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branchId as string)
        .maybeSingle()
      if (error) throw error
      return (data?.name as string | undefined) ?? ''
    },
    enabled: !!branchId,
  })

  const employees = (employeesQuery.data ?? []).filter((e) => e.is_active)
  const rates = ratesQuery.data ?? {}
  const items = itemsQuery.data ?? []
  const availableItems = items.filter((i) => i.quantity > 0)

  const itemId =
    itemChoice === undefined ? (availableItems[0]?.id ?? '') : itemChoice
  const selectedItem = items.find((i) => i.id === itemId) ?? null

  // حسابات حية
  const selectedSections = SECTIONS.filter((s) => assign[s.key])
  const workCost = round2(
    selectedSections.reduce((sum, s) => sum + (rates[s.key] ?? 0), 0)
  )
  const expensesTotal = round2(
    expenses.reduce((sum, e) => {
      const n = toNumber(e.amount)
      return sum + (Number.isNaN(n) ? 0 : n)
    }, 0)
  )
  const priceNum = toNumber(price)
  const net = round2((Number.isNaN(priceNum) ? 0 : priceNum) - expensesTotal - workCost)
  const missingRates = selectedSections.filter((s) => rates[s.key] === undefined)

  const mutation = useMutation({
    mutationFn: async () => {
      const work = selectedSections.map((s) => ({
        employee_id: assign[s.key],
        section: s.key,
      }))
      const expenseRows = expenses
        .filter((e) => e.description.trim() || e.amount.trim())
        .map((e) => ({
          description: e.description.trim(),
          amount: toNumber(e.amount),
        }))

      const { data, error } = await supabase.rpc('create_invoice', {
        p_customer_id: mode === 'existing' && picked ? picked.id : null,
        p_customer_name: mode === 'new' ? newName.trim() : null,
        p_customer_phone: mode === 'new' ? newPhone.trim() : null,
        p_car_model: car.trim() || null,
        p_plate_number: plate.trim() || null,
        p_total_price: priceNum,
        p_notes: notes.trim() || null,
        p_work: work,
        p_expenses: expenseRows,
        p_item_id: selectedItem ? selectedItem.id : null,
        p_item_qty: selectedItem ? toNumber(itemQty) : null,
      })
      if (error) throw error
      return data as { id: string; invoice_no: number }
    },
    onSuccess: (result) => {
      const customerName = mode === 'existing' && picked ? picked.name : newName.trim()
      const customerPhone =
        mode === 'existing' && picked ? (picked.phone ?? '') : newPhone.trim()

      setSaved({
        invoiceNo: Number(result.invoice_no),
        createdAt: new Date().toISOString(),
        branchName: branchQuery.data ?? '',
        customerName,
        customerPhone,
        carModel: car.trim(),
        plate: plate.trim(),
        price: priceNum,
        notes: notes.trim(),
        work: selectedSections.map((s) => ({
          employee:
            employees.find((e) => e.id === assign[s.key])?.full_name ?? '—',
          section: s.key,
          rate: rates[s.key] ?? 0,
        })),
        expenses: expenses
          .filter((e) => e.description.trim() && !Number.isNaN(toNumber(e.amount)))
          .map((e) => ({
            description: e.description.trim(),
            amount: toNumber(e.amount),
          })),
        itemName: selectedItem ? selectedItem.name : null,
        itemQty: selectedItem ? toNumber(itemQty) : 0,
      })

      toast.success('تم حفظ الفاتورة')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error(errorMessage(e))
    },
  })

  function reset() {
    setMode('new')
    setPicked(null)
    setNewName('')
    setNewPhone('')
    setCar('')
    setPlate('')
    setAssign({ front: '', back: '', side_one: '', side_two: '' })
    setExpenses([])
    setItemChoice(undefined)
    setItemQty('1')
    setPrice('')
    setNotes('')
    setSaved(null)
  }

  function submit(e: FormEvent) {
    e.preventDefault()

    if (mode === 'existing' && !picked) {
      toast.error('اختار العميل، أو اختار "عميل جديد"')
      return
    }
    if (mode === 'new' && !newName.trim()) {
      toast.error('اكتب اسم العميل')
      return
    }
    if (selectedSections.length === 0) {
      toast.error('اختار الموظف اللي عمل على جزء واحد على الأقل')
      return
    }
    if (missingRates.length > 0) {
      toast.error('مدير الفرع لسه ماحددش نسبة بعض الأجزاء المختارة')
      return
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      toast.error('اكتب سعر الفاتورة')
      return
    }
    for (const row of expenses) {
      const filled = row.description.trim() || row.amount.trim()
      if (!filled) continue
      const n = toNumber(row.amount)
      if (!row.description.trim() || Number.isNaN(n) || n <= 0) {
        toast.error('كمّل بيانات المصروفات (البيان والمبلغ)')
        return
      }
    }
    if (selectedItem) {
      const q = toNumber(itemQty)
      if (Number.isNaN(q) || q <= 0) {
        toast.error('اكتب كمية الرول بشكل صحيح')
        return
      }
      if (q > selectedItem.quantity) {
        toast.error('الكمية في المخزون مش كفاية')
        return
      }
    }

    mutation.mutate()
  }

  // ---------- بعد الحفظ ----------
  if (saved) {
    return (
      <div className="flex max-w-3xl flex-col" style={{ ...centerX, gap: 24 }}>
        <section
          className={`${cardClass} flex flex-col items-center text-center`}
          style={{ ...pad(32, 20), gap: 12 }}
        >
          <MdCheckCircle size={56} className="text-emerald-400" />
          <h1 className="text-2xl font-bold">تم حفظ الفاتورة #{saved.invoiceNo}</h1>
          <p className="text-ink-400">
            {saved.customerName} •{' '}
            <span dir="ltr" className="font-semibold text-ink-100">
              {money(saved.price)}
            </span>
          </p>
          {saved.itemName && (
            <p className="text-sm text-ink-400">
              اتخصم {saved.itemQty} من {saved.itemName}
            </p>
          )}
        </section>

        <div className="flex flex-col sm:flex-row" style={{ gap: 12 }}>
          <button
            type="button"
            onClick={() => printCustomerInvoice(saved)}
            className={`${primaryBtnClass} flex-1`}
            style={{ ...pad(14, 20), gap: 8 }}
          >
            <MdPrint size={20} />
            فاتورة العميل
          </button>
          <button
            type="button"
            onClick={() => printInternalInvoice(saved)}
            className={`${ghostBtnClass} flex-1`}
            style={{ ...pad(14, 20), gap: 8 }}
          >
            <MdPrint size={20} />
            الفاتورة الداخلية
          </button>
        </div>

        <button
          type="button"
          onClick={reset}
          className={ghostBtnClass}
          style={{ ...pad(14, 20), gap: 8 }}
        >
          <MdAdd size={20} />
          فاتورة جديدة
        </button>

        <p className="text-xs text-ink-400">
          في نافذة الطباعة اختار &quot;Save as PDF&quot; لو عايز ملف PDF.
        </p>
      </div>
    )
  }

  // ---------- الفورم ----------
  const toggleBtn = (active: boolean) =>
    `flex-1 rounded-lg text-sm font-semibold transition ${
      active
        ? 'bg-brand-600 text-white'
        : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
    }`

  return (
    <form
      onSubmit={submit}
      className="flex max-w-3xl flex-col"
      style={{ ...centerX, gap: 20 }}
    >
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">فاتورة جديدة</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          بيانات العميل والعربية، ومين عمل إيه، وبعدها السعر.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي للسيلز بس. ادخل بحساب سيلز عشان تعمل فاتورة.
        </p>
      )}

      {/* 1) العميل */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <h2 className="font-bold">العميل</h2>

        <div
          className="flex rounded-xl border border-ink-700 bg-ink-950 sm:max-w-sm"
          style={{ ...pad(4), gap: 4 }}
        >
          <button
            type="button"
            onClick={() => setMode('new')}
            className={toggleBtn(mode === 'new')}
            style={pad(8, 8)}
          >
            عميل جديد
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={toggleBtn(mode === 'existing')}
            style={pad(8, 8)}
          >
            عميل موجود
          </button>
        </div>

        {mode === 'new' ? (
          <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم العميل"
              className={inputClass}
              style={pad(12, 16)}
            />
            <input
              type="tel"
              dir="ltr"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="رقم التليفون (اختياري)"
              className={`${inputClass} text-left`}
              style={pad(12, 16)}
            />
          </div>
        ) : picked ? (
          <div
            className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10"
            style={{ ...pad(12, 16), gap: 12 }}
          >
            <div className="min-w-0">
              <p className="truncate font-bold">{picked.name}</p>
              {picked.phone && (
                <p dir="ltr" className="text-right text-sm text-ink-400">
                  {picked.phone}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="shrink-0 text-sm font-semibold text-brand-400 hover:underline"
            >
              تغيير
            </button>
          </div>
        ) : (
          <CustomerSearch onPick={setPicked} />
        )}
      </section>

      {/* 2) العربية */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <h2 className="font-bold">العربية</h2>
        <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
          <input
            value={car}
            onChange={(e) => setCar(e.target.value)}
            placeholder="الموديل (اختياري): كيا سبورتاج"
            className={inputClass}
            style={pad(12, 16)}
          />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="رقم اللوحة (اختياري)"
            className={inputClass}
            style={pad(12, 16)}
          />
        </div>
      </section>

      {/* 3) مين عمل إيه */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <div>
          <h2 className="font-bold">مين عمل إيه</h2>
          <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
            اختار الموظف اللي عمل كل جزء. الجزء اللي ماتعملش سيبه &quot;ماتعملش&quot;.
          </p>
        </div>

        {employeesQuery.data && employees.length === 0 && (
          <p className="text-sm text-brand-400">
            مفيش موظفين شغّالين في الفرع. مدير الفرع لازم يضيفهم الأول.
          </p>
        )}

        <div className="flex flex-col" style={{ gap: 12 }}>
          {SECTIONS.map((s) => {
            const rate = rates[s.key]
            return (
              <div
                key={s.key}
                className="grid items-center sm:grid-cols-2"
                style={{ gap: 8 }}
              >
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-xs text-ink-400">
                    {rate === undefined ? (
                      <span className="text-brand-400">النسبة مش متحددة</span>
                    ) : (
                      <>
                        النسبة:{' '}
                        <span dir="ltr">{money(rate)}</span>
                      </>
                    )}
                  </p>
                </div>
                <select
                  value={assign[s.key]}
                  onChange={(e) =>
                    setAssign((prev) => ({ ...prev, [s.key]: e.target.value }))
                  }
                  className={inputClass}
                  style={pad(12, 12)}
                >
                  <option value="">ماتعملش</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </section>

      {/* 4) مصروفات الشغل */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <div>
          <h2 className="font-bold">مصروفات الشغل (اختياري)</h2>
          <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
            خامات أو أي مصروف خاص بالعربية دي.
          </p>
        </div>

        {expenses.map((row) => (
          <div
            key={row.key}
            className="grid items-center"
            style={{ gap: 8, gridTemplateColumns: '1fr 140px auto' }}
          >
            <input
              value={row.description}
              onChange={(e) =>
                setExpenses((prev) =>
                  prev.map((r) =>
                    r.key === row.key ? { ...r, description: e.target.value } : r
                  )
                )
              }
              placeholder="البيان"
              className={inputClass}
              style={pad(12, 14)}
            />
            <MoneyInput
              value={row.amount}
              onChange={(v) =>
                setExpenses((prev) =>
                  prev.map((r) => (r.key === row.key ? { ...r, amount: v } : r))
                )
              }
              placeholder="0"
            />
            <button
              type="button"
              aria-label="مسح المصروف"
              onClick={() =>
                setExpenses((prev) => prev.filter((r) => r.key !== row.key))
              }
              className="rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-brand-400"
              style={pad(8)}
            >
              <MdDeleteOutline size={22} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setExpenses((prev) => [
              ...prev,
              { key: newKey(), description: '', amount: '' },
            ])
          }
          className={`${ghostBtnClass} self-start`}
          style={{ ...pad(10, 16), gap: 6 }}
        >
          <MdAdd size={18} />
          إضافة مصروف
        </button>
      </section>

      {/* 5) المخزون */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <div>
          <h2 className="font-bold">خصم من المخزون</h2>
          <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
            الرول اللي اتستخدم في العربية دي.
          </p>
        </div>

        {itemsQuery.data && availableItems.length === 0 ? (
          <p className="text-sm text-ink-400">
            مفيش أصناف متاحة في المخزون، فمش هيتخصم حاجة.
          </p>
        ) : (
          <div className="grid sm:grid-cols-3" style={{ gap: 12 }}>
            <select
              value={itemId}
              onChange={(e) => setItemChoice(e.target.value)}
              className={`${inputClass} sm:col-span-2`}
              style={pad(12, 12)}
            >
              <option value="">من غير خصم</option>
              {availableItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (متاح {i.quantity} {i.unit})
                </option>
              ))}
            </select>

            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={itemQty}
              disabled={!selectedItem}
              onChange={(e) => setItemQty(e.target.value)}
              placeholder="الكمية"
              className={`${inputClass} text-left disabled:opacity-50`}
              style={pad(12, 16)}
            />
          </div>
        )}
      </section>

      {/* 6) السعر */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <h2 className="font-bold">السعر</h2>

        <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
          <MoneyInput
            id="invoice-price"
            value={price}
            onChange={setPrice}
            placeholder="سعر الفاتورة"
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات (اختياري)"
          rows={2}
          className={inputClass}
          style={pad(12, 16)}
        />

        <div
          className="flex flex-col rounded-xl bg-ink-950 text-sm"
          style={{ ...pad(14, 16), gap: 8 }}
        >
          <div className="flex justify-between" style={{ gap: 12 }}>
            <span className="text-ink-400">مصروفات الشغل</span>
            <span dir="ltr" className="font-semibold">
              {money(expensesTotal)}
            </span>
          </div>
          <div className="flex justify-between" style={{ gap: 12 }}>
            <span className="text-ink-400">نسب الموظفين</span>
            <span dir="ltr" className="font-semibold">
              {money(workCost)}
            </span>
          </div>
          <div
            className="flex justify-between border-t border-ink-700"
            style={{ paddingTop: 8, gap: 12 }}
          >
            <span className="font-bold">صافي العملية</span>
            <span
              dir="ltr"
              className={`font-bold ${
                net > 0 ? 'text-emerald-400' : net < 0 ? 'text-brand-400' : ''
              }`}
            >
              {money(net)}
            </span>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={mutation.isPending || !branchId}
        className={primaryBtnClass}
        style={pad(16, 20)}
      >
        {mutation.isPending ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
      </button>
    </form>
  )
}
