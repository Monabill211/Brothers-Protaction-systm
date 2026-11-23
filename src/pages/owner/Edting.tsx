import { useState } from 'react'
import { MdAdd, MdClose, MdDelete } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { SECTION_LABEL } from '../../lib/sections'
import { money } from '../../lib/format'
import type { Invoice, Employee } from './Operations'
type Props = {
  invoice: Invoice
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-sm text-white outline-none focus:border-amber-500'

export function EditInvoiceModal({ invoice, employees, onClose, onSaved }: Props) {
  const isManual = invoice.kind === 'manual'

  const [customerName, setCustomerName] = useState(invoice.customer_name === '—' ? '' : invoice.customer_name)
  const [customerPhone, setCustomerPhone] = useState(invoice.customer_phone ?? '')
  const [carModel, setCarModel] = useState(invoice.car_model ?? '')
  const [plateNumber, setPlateNumber] = useState(invoice.plate_number ?? '')
  const [carYear, setCarYear] = useState(invoice.car_year ? String(invoice.car_year) : '')
  const [carColor, setCarColor] = useState(invoice.car_color ?? '')
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [totalPrice, setTotalPrice] = useState(String(invoice.total_price))

  const [lines, setLines] = useState(
    invoice.lines.map((l) => ({ description: l.description, amount: String(l.amount) }))
  )
  const [work, setWork] = useState(
    invoice.work.map((w) => ({
      employee_id: w.employee_id,
      section: w.section,
      rate: String(w.rate),
    }))
  )
  const [expenses, setExpenses] = useState(
    invoice.expenses.map((e) => ({ description: e.description, amount: String(e.amount) }))
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const branchEmployees = employees.filter(
    (e) => !e.branch_id || e.branch_id === invoice.branch_id
  )
  const sections = Object.entries(SECTION_LABEL)

  const manualTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const { error: rpcError } = await supabase.rpc('owner_update_invoice', {
        p_invoice_id: invoice.id,
        p_customer_name: customerName,
        p_customer_phone: customerPhone || null,
        p_car_model: carModel || null,
        p_plate_number: plateNumber || null,
        p_car_year: carYear ? Number(carYear) : null,
        p_car_color: carColor || null,
        p_notes: notes || null,
        p_total_price: isManual ? manualTotal : Number(totalPrice),
        p_work: isManual
          ? []
          : work.map((w) => ({
              employee_id: w.employee_id,
              section: w.section,
              rate: Number(w.rate),
            })),
        p_lines: isManual
          ? lines.map((l) => ({
              description: l.description,
              amount: Number(l.amount),
            }))
          : [],
        p_expenses: expenses
          .filter((ex) => ex.description.trim() && Number(ex.amount) > 0)
          .map((ex) => ({
            description: ex.description,
            amount: Number(ex.amount),
          })),
      })

      if (rpcError) throw rpcError
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs"
      style={{ padding: '1rem' }}
    >
      <form
        onSubmit={handleSave}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 text-ink-100"
        style={{ padding: '1.25rem' }}
      >
        {/* الهيدر */}
        <div
          className="flex items-center justify-between border-b border-ink-800"
          style={{ paddingBottom: '0.85rem', marginBottom: '1rem' }}
        >
          <h2 className="text-lg font-bold text-white">
            تعديل فاتورة #{invoice.invoice_no}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg text-ink-400 hover:text-white"
            style={{ padding: '0.25rem' }}
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            className="rounded-lg border border-rose-500/40 bg-rose-950/40 text-sm text-rose-300"
            style={{ padding: '0.65rem 0.85rem', marginBottom: '1rem' }}
          >
            {error}
          </div>
        )}

        {/* بيانات العميل */}
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>
              اسم العميل *
            </label>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputClass}
              style={{ padding: '0.5rem 0.75rem' }}
            />
          </div>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>
              رقم التليفون
            </label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className={inputClass}
              style={{ padding: '0.5rem 0.75rem' }}
            />
          </div>
        </div>

        {/* بيانات السيارة */}
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>الموديل</label>
            <input value={carModel} onChange={(e) => setCarModel(e.target.value)} className={inputClass} style={{ padding: '0.5rem 0.75rem' }} />
          </div>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>اللوحة</label>
            <input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} className={inputClass} style={{ padding: '0.5rem 0.75rem' }} />
          </div>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>السنة</label>
            <input type="number" value={carYear} onChange={(e) => setCarYear(e.target.value)} className={inputClass} style={{ padding: '0.5rem 0.75rem' }} />
          </div>
          <div>
            <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>اللون</label>
            <input value={carColor} onChange={(e) => setCarColor(e.target.value)} className={inputClass} style={{ padding: '0.5rem 0.75rem' }} />
          </div>
        </div>

        {/* الفاتورة العادية: البنود */}
        {isManual ? (
          <div style={{ marginBottom: '1rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
              <span className="text-xs font-bold text-ink-300">بنود الفاتورة (الإجمالي: {money(manualTotal)})</span>
              <button
                type="button"
                onClick={() => setLines([...lines, { description: '', amount: '' }])}
                className="flex items-center rounded-lg bg-ink-800 text-xs text-red-400 hover:bg-ink-700"
                style={{ padding: '0.3rem 0.6rem', gap: '0.25rem' }}
              >
                <MdAdd /> إضافة بند
              </button>
            </div>
            <div className="flex flex-col" style={{ gap: '0.5rem' }}>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center" style={{ gap: '0.5rem' }}>
                  <input
                    required
                    placeholder="الوصف"
                    value={l.description}
                    onChange={(e) => {
                      const next = [...lines]
                      next[i].description = e.target.value
                      setLines(next)
                    }}
                    className={inputClass}
                    style={{ padding: '0.45rem 0.65rem' }}
                  />
                  <input
                    required
                    type="number"
                    placeholder="المبلغ"
                    value={l.amount}
                    onChange={(e) => {
                      const next = [...lines]
                      next[i].amount = e.target.value
                      setLines(next)
                    }}
                    className={`${inputClass} max-w-[120px]`}
                    style={{ padding: '0.45rem 0.65rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <MdDelete className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* فاتورة الحماية: السعر الإجمالي + شغل الصنايعية */
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>
                السعر الإجمالي *
              </label>
              <input
                required
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className={inputClass}
                style={{ padding: '0.5rem 0.75rem' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                <span className="text-xs font-bold text-ink-300">التنفيذ والأقسام</span>
                <button
                  type="button"
                  onClick={() =>
                    setWork([
                      ...work,
                      {
                        employee_id: branchEmployees[0]?.id ?? '',
                        section: sections[0]?.[0] ?? '',
                        rate: '100',
                      },
                    ])
                  }
                  className="flex items-center rounded-lg bg-ink-800 text-xs text-red-400 hover:bg-ink-700"
                  style={{ padding: '0.3rem 0.6rem', gap: '0.25rem' }}
                >
                  <MdAdd /> إضافة صنايعي
                </button>
              </div>
              <div className="flex flex-col" style={{ gap: '0.5rem' }}>
                {work.map((w, i) => (
                  <div key={i} className="flex items-center" style={{ gap: '0.5rem' }}>
                    <select
                      required
                      value={w.employee_id}
                      onChange={(e) => {
                        const next = [...work]
                        next[i].employee_id = e.target.value
                        setWork(next)
                      }}
                      className={inputClass}
                      style={{ padding: '0.45rem 0.65rem' }}
                    >
                      <option value="">اختر الموظف</option>
                      {branchEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </option>
                      ))}
                    </select>

                    <select
                      required
                      value={w.section}
                      onChange={(e) => {
                        const next = [...work]
                        next[i].section = e.target.value
                        setWork(next)
                      }}
                      className={inputClass}
                      style={{ padding: '0.45rem 0.65rem' }}
                    >
                      {sections.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <input
                      required
                      type="number"
                      placeholder="النسبة"
                      value={w.rate}
                      onChange={(e) => {
                        const next = [...work]
                        next[i].rate = e.target.value
                        setWork(next)
                      }}
                      className={`${inputClass} max-w-[90px]`}
                      style={{ padding: '0.45rem 0.65rem' }}
                    />

                    <button
                      type="button"
                      onClick={() => setWork(work.filter((_, idx) => idx !== i))}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <MdDelete className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* مصاريف الفاتورة */}
        <div style={{ marginBottom: '1rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
            <span className="text-xs font-bold text-rose-400">مصاريف الفاتورة</span>
            <button
              type="button"
              onClick={() => setExpenses([...expenses, { description: '', amount: '' }])}
              className="flex items-center rounded-lg bg-ink-800 text-xs text-rose-400 hover:bg-ink-700"
              style={{ padding: '0.3rem 0.6rem', gap: '0.25rem' }}
            >
              <MdAdd /> إضافة مصروف
            </button>
          </div>
          <div className="flex flex-col" style={{ gap: '0.5rem' }}>
            {expenses.map((ex, i) => (
              <div key={i} className="flex items-center" style={{ gap: '0.5rem' }}>
                <input
                  placeholder="وصف المصروف"
                  value={ex.description}
                  onChange={(e) => {
                    const next = [...expenses]
                    next[i].description = e.target.value
                    setExpenses(next)
                  }}
                  className={inputClass}
                  style={{ padding: '0.45rem 0.65rem' }}
                />
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={ex.amount}
                  onChange={(e) => {
                    const next = [...expenses]
                    next[i].amount = e.target.value
                    setExpenses(next)
                  }}
                  className={`${inputClass} max-w-[120px]`}
                  style={{ padding: '0.45rem 0.65rem' }}
                />
                <button
                  type="button"
                  onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))}
                  className="text-rose-400 hover:text-rose-300"
                >
                  <MdDelete className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* الملاحظات */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="block text-xs text-ink-400" style={{ marginBottom: '0.3rem' }}>
            ملاحظات
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            style={{ padding: '0.5rem 0.75rem' }}
          />
        </div>

        {/* أزرار الحفظ والإلغاء */}
        <div className="flex justify-end" style={{ gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink-700 text-sm text-ink-300 hover:bg-ink-800"
            style={{ padding: '0.55rem 1.1rem' }}
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-500 text-sm font-bold text-ink-950 hover:bg-red-400 disabled:opacity-50"
            style={{ padding: '0.55rem 1.35rem' }}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </div>
  )
}