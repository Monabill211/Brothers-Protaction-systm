import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MdAdd, MdCheckCircle, MdDeleteOutline, MdPrint } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'
import { money } from '../../lib/format'
import MoneyInput from '../../components/MoneyInput'
import CustomerPicker, {
  type CustomerHit,
} from '../../components/CustomerPicker'
import {
  printCustomerInvoice,
  printInternalInvoice,
  type PrintableInvoice,
} from '../../lib/printInvoice'

type Row = { key: string; description: string; amount: string }

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

const newRow = (): Row => ({
  key: Math.random().toString(36).slice(2),
  description: '',
  amount: '',
})

function errorMessage(e: unknown) {
  const msg =
    e instanceof Error ? e.message : ((e as { message?: string })?.message ?? '')
  if (msg.includes('no lines')) return 'اكتب بند واحد على الأقل'
  if (msg.includes('customer not found')) return 'العميل مش موجود في فرعك'
  if (msg.includes('not allowed'))
    return 'الصفحة دي للسيلز ومدير الفرع بس'
  return 'مقدرتش أحفظ الفاتورة. اتأكد إن ملفات 10 و12 اتشغّلت وإنك داخل بحساب سيلز أو مدير فرع'
}

// ---------- صفوف (بنود / مصروفات) ----------

function RowEditor({
  rows,
  onChange,
  descriptionPlaceholder,
  addLabel,
}: {
  rows: Row[]
  onChange: (rows: Row[]) => void
  descriptionPlaceholder: string
  addLabel: string
}) {
  const update = (key: string, patch: Partial<Row>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid items-center"
          style={{ gap: 8, gridTemplateColumns: '1fr 140px auto' }}
        >
          <input
            value={row.description}
            onChange={(e) => update(row.key, { description: e.target.value })}
            placeholder={descriptionPlaceholder}
            className={inputClass}
            style={pad(12, 14)}
          />
          <MoneyInput
            value={row.amount}
            onChange={(v) => update(row.key, { amount: v })}
            placeholder="0"
          />
          <button
            type="button"
            aria-label="مسح"
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            className="rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-brand-400"
            style={pad(8)}
          >
            <MdDeleteOutline size={22} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className={`${ghostBtnClass} self-start`}
        style={{ ...pad(10, 16), gap: 6 }}
      >
        <MdAdd size={18} />
        {addLabel}
      </button>
    </div>
  )
}

// ---------- الصفحة ----------

export default function ManualInvoice({ typeSwitch }: { typeSwitch: ReactNode }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const branchId = profile?.branch_id ?? null

  // العميل
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [picked, setPicked] = useState<CustomerHit | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // العربية (اختياري)
  const [car, setCar] = useState('')
  const [plate, setPlate] = useState('')

  // البنود اللي بتتكتب بإيد السيلز + مصروفات (اختياري)
  const [lines, setLines] = useState<Row[]>(() => [newRow()])
  const [expenses, setExpenses] = useState<Row[]>([])
  const [notes, setNotes] = useState('')

  const [saved, setSaved] = useState<PrintableInvoice | null>(null)

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

  const isFilled = (r: Row) => r.description.trim() !== '' || r.amount.trim() !== ''
  const isComplete = (r: Row) => {
    const n = toNumber(r.amount)
    return r.description.trim() !== '' && !Number.isNaN(n) && n > 0
  }

  const completeLines = lines.filter(isComplete)
  const completeExpenses = expenses.filter(isComplete)

  const total = round2(completeLines.reduce((s, r) => s + toNumber(r.amount), 0))
  const expensesTotal = round2(
    completeExpenses.reduce((s, r) => s + toNumber(r.amount), 0)
  )
  const net = round2(total - expensesTotal)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_manual_invoice', {
        p_customer_id: mode === 'existing' && picked ? picked.id : null,
        p_customer_name: mode === 'new' ? newName.trim() : null,
        p_customer_phone: mode === 'new' ? newPhone.trim() : null,
        p_car_model: car.trim() || null,
        p_plate_number: plate.trim() || null,
        p_notes: notes.trim() || null,
        p_lines: completeLines.map((r) => ({
          description: r.description.trim(),
          amount: toNumber(r.amount),
        })),
        p_expenses: completeExpenses.map((r) => ({
          description: r.description.trim(),
          amount: toNumber(r.amount),
        })),
      })
      if (error) throw error
      return data as { id: string; invoice_no: number }
    },
    onSuccess: (result) => {
      const customerName =
        mode === 'existing' && picked ? picked.name : newName.trim()
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
        price: total,
        notes: notes.trim(),
        work: [],
        lines: completeLines.map((r) => ({
          description: r.description.trim(),
          amount: toNumber(r.amount),
        })),
        expenses: completeExpenses.map((r) => ({
          description: r.description.trim(),
          amount: toNumber(r.amount),
        })),
        itemName: null,
        itemQty: 0,
      })

      toast.success('تم حفظ الفاتورة')
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
    setLines([newRow()])
    setExpenses([])
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
    if (lines.some((r) => isFilled(r) && !isComplete(r))) {
      toast.error('كمّل بيانات البنود (البند والمبلغ)')
      return
    }
    if (completeLines.length === 0) {
      toast.error('اكتب بند واحد على الأقل بسعره')
      return
    }
    if (expenses.some((r) => isFilled(r) && !isComplete(r))) {
      toast.error('كمّل بيانات المصروفات (البيان والمبلغ)')
      return
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
  return (
    <form
      onSubmit={submit}
      className="flex max-w-3xl flex-col"
      style={{ ...centerX, gap: 20 }}
    >
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">فاتورة جديدة</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          فاتورة عادية: اكتب الخدمات وأسعارها بإيدك.
        </p>
      </section>

      {typeSwitch}

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي للسيلز ومدير الفرع بس. ادخل بحساب سيلز أو مدير فرع عشان تعمل فاتورة.
        </p>
      )}

      <CustomerPicker
        mode={mode}
        onModeChange={setMode}
        picked={picked}
        onPick={setPicked}
        name={newName}
        onNameChange={setNewName}
        phone={newPhone}
        onPhoneChange={setNewPhone}
      />

      {/* بنود الفاتورة */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <div>
          <h2 className="font-bold">بنود الفاتورة</h2>
          <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
            اكتب كل خدمة وسعرها. الإجمالي بيتحسب لوحده.
          </p>
        </div>

        <RowEditor
          rows={lines}
          onChange={setLines}
          descriptionPlaceholder="الخدمة (مثلاً: عزل حراري )"
          addLabel="إضافة بند"
        />
      </section>

      {/* العربية (اختياري) */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <h2 className="font-bold">العربية (اختياري)</h2>
        <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
          <input
            value={car}
            onChange={(e) => setCar(e.target.value)}
            placeholder="الموديل"
            className={inputClass}
            style={pad(12, 16)}
          />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="رقم اللوحة"
            className={inputClass}
            style={pad(12, 16)}
          />
        </div>
      </section>

      {/* مصروفات (اختياري) */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
        <div>
          <h2 className="font-bold">مصروفات على الفاتورة (اختياري)</h2>
          <p className="text-sm text-ink-400" style={{ marginTop: 4 }}>
            لو الفاتورة دي كلّفتك خامات أو مصروف، سجّله هنا عشان الصافي يطلع صح.
          </p>
        </div>

        <RowEditor
          rows={expenses}
          onChange={setExpenses}
          descriptionPlaceholder="البيان"
          addLabel="إضافة مصروف"
        />
      </section>

      {/* الإجمالي */}
      <section
        className={`${cardClass} flex flex-col`}
        style={{ ...pad(20), gap: 14 }}
      >
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
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <span className="text-base font-bold">إجمالي الفاتورة</span>
            <span dir="ltr" className="text-xl font-bold">
              {money(total)}
            </span>
          </div>
          {expensesTotal > 0 && (
            <>
              <div className="flex justify-between" style={{ gap: 12 }}>
                <span className="text-ink-400">المصروفات</span>
                <span dir="ltr" className="font-semibold">
                  {money(expensesTotal)}
                </span>
              </div>
              <div
                className="flex justify-between border-t border-ink-700"
                style={{ paddingTop: 8, gap: 12 }}
              >
                <span className="font-bold">الصافي</span>
                <span
                  dir="ltr"
                  className={`font-bold ${
                    net > 0 ? 'text-emerald-400' : net < 0 ? 'text-brand-400' : ''
                  }`}
                >
                  {money(net)}
                </span>
              </div>
            </>
          )}
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
