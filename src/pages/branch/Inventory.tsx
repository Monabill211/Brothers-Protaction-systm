import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { toast } from 'sonner'
import { MdDeleteOutline } from 'react-icons/md'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/auth-context'
import { centerX, pad } from '../../lib/spacing'

type Item = {
  id: string
  name: string
  quantity: number
  unit: string
}

type Movement = {
  id: string
  change: number
  reason: string | null
  created_at: string
  invoice_no: number | null
}

type Panel = 'add' | 'remove' | 'history' | null

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const primaryBtnClass =
  'rounded-lg bg-brand-600 text-sm font-bold text-white transition ' +
  'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtnClass =
  'flex-1 rounded-lg border border-ink-700 text-sm font-semibold text-ink-100 ' +
  'transition hover:bg-ink-800'

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

function toNumber(value: string) {
  if (value.trim() === '') return NaN
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? ''
  const code = (e as { code?: string })?.code
  if (code === '23505') return 'الصنف ده موجود بالفعل'
  if (msg.includes('below zero')) return 'الكمية مش كفاية للخصم'
  return 'مقدرتش أحفظ. اتأكد إنك داخل بحساب مدير الفرع وإن ملف 07 اتشغّل'
}

// ---------- الداتا ----------

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

async function fetchMovements(itemId: string): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id, change, reason, created_at, invoices(invoice_no)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const inv = Array.isArray(r.invoices) ? r.invoices[0] : r.invoices
    return {
      id: String(r.id),
      change: Number(r.change),
      reason: (r.reason as string | null) ?? null,
      created_at: String(r.created_at),
      invoice_no: inv ? Number((inv as { invoice_no: number }).invoice_no) : null,
    }
  })
}

// ---------- إضافة صنف ----------

function AddItemForm() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('رول')
  const [qty, setQty] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const opening = qty.trim() === '' ? 0 : toNumber(qty)

      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ name: name.trim(), unit: unit.trim() || 'رول', quantity: 0 })
        .select('id')
        .single()
      if (error) throw error

      if (opening > 0) {
        const { error: moveError } = await supabase.rpc('adjust_inventory', {
          p_item_id: data.id,
          p_change: opening,
          p_reason: 'رصيد افتتاحي',
        })
        if (moveError) throw moveError
      }
    },
    onSuccess: () => {
      toast.success('تم إضافة الصنف')
      setName('')
      setQty('')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error(errorMessage(e))
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('اكتب اسم الصنف')
      return
    }
    if (qty.trim() !== '') {
      const n = toNumber(qty)
      if (Number.isNaN(n) || n < 0) {
        toast.error('اكتب الكمية بشكل صحيح')
        return
      }
    }
    mutation.mutate()
  }

  return (
    <form
      onSubmit={submit}
      className={`${cardClass} flex flex-col`}
      style={{ ...pad(20), gap: 16 }}
    >
      <h2 className="font-bold">إضافة صنف جديد</h2>

      <div className="grid sm:grid-cols-3" style={{ gap: 12 }}>
        <div
          className="flex flex-col sm:col-span-2"
          style={{ gap: 8 }}
        >
          <label htmlFor="inv-name" className="text-sm font-semibold">
            اسم الصنف
          </label>
          <input
            id="inv-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: رول حماية شفاف"
            className={inputClass}
            style={pad(12, 16)}
          />
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="inv-unit" className="text-sm font-semibold">
            الوحدة
          </label>
          <input
            id="inv-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="رول"
            className={inputClass}
            style={pad(12, 16)}
          />
        </div>
      </div>

      <div className="flex flex-col sm:max-w-xs" style={{ gap: 8 }}>
        <label htmlFor="inv-qty" className="text-sm font-semibold">
          الكمية الحالية (اختياري)
        </label>
        <input
          id="inv-qty"
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0"
          className={`${inputClass} text-left`}
          style={pad(12, 16)}
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className={`${primaryBtnClass} self-start`}
        style={pad(10, 20)}
      >
        {mutation.isPending ? 'جاري الإضافة...' : 'إضافة الصنف'}
      </button>
    </form>
  )
}

// ---------- كارت الصنف ----------

function ItemCard({ item }: { item: Item }) {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<Panel>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  const history = useQuery({
    queryKey: ['inventory-movements', item.id],
    queryFn: () => fetchMovements(item.id),
    enabled: panel === 'history',
  })

  const adjust = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const { error } = await supabase.rpc('adjust_inventory', {
        p_item_id: item.id,
        p_change: sign * toNumber(qty),
        p_reason: reason.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم تسجيل الحركة')
      setQty('')
      setReason('')
      setPanel(null)
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', item.id] })
    },
    onError: (e) => {
      console.error(e)
      toast.error(errorMessage(e))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم مسح الصنف')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (e) => {
      console.error(e)
      toast.error('مقدرتش أمسح الصنف')
    },
  })

  function remove() {
    const left =
      item.quantity > 0 ? `\nلسه فيه ${fmt(item.quantity)} ${item.unit} في المخزون.` : ''
    if (
      window.confirm(
        `تمسح الصنف "${item.name}" وسجل حركته؟${left}\nالمسح نهائي ومينفعش يتراجع عنه.`
      )
    ) {
      deleteMutation.mutate()
    }
  }

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next))
    setQty('')
    setReason('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = toNumber(qty)
    if (Number.isNaN(n) || n <= 0) {
      toast.error('اكتب كمية أكبر من صفر')
      return
    }
    if (panel === 'remove' && !reason.trim()) {
      toast.error('اكتب سبب الخصم (تالف، جرد، ...)')
      return
    }
    adjust.mutate(panel === 'add' ? 1 : -1)
  }

  const tab = (key: Exclude<Panel, null>) =>
    `${ghostBtnClass} ${panel === key ? 'bg-ink-800' : ''}`

  return (
    <div className={`${cardClass} flex flex-col`} style={{ ...pad(20), gap: 16 }}>
      <div className="flex items-start justify-between" style={{ gap: 8 }}>
        <h3 className="min-w-0 truncate text-lg font-bold">{item.name}</h3>
        {item.quantity === 0 && (
          <span
            className="shrink-0 rounded-full bg-brand-600/20 text-xs font-semibold text-brand-400"
            style={pad(4, 12)}
          >
            خلصان
          </span>
        )}
      </div>

      <p className="flex items-baseline" style={{ gap: 8 }}>
        <span dir="ltr" className="text-3xl font-bold">
          {fmt(item.quantity)}
        </span>
        <span className="text-ink-400">{item.unit}</span>
      </p>

      <div className="flex" style={{ gap: 8 }}>
        <button
          type="button"
          onClick={() => toggle('add')}
          className={tab('add')}
          style={pad(10, 8)}
        >
          إضافة
        </button>
        <button
          type="button"
          onClick={() => toggle('remove')}
          className={tab('remove')}
          style={pad(10, 8)}
        >
          خصم
        </button>
        <button
          type="button"
          onClick={() => toggle('history')}
          className={tab('history')}
          style={pad(10, 8)}
        >
          السجل
        </button>
      </div>

      {(panel === 'add' || panel === 'remove') && (
        <form onSubmit={submit} className="flex flex-col" style={{ gap: 12 }}>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={panel === 'add' ? 'الكمية اللي دخلت' : 'الكمية اللي هتتخصم'}
            className={`${inputClass} text-left`}
            style={pad(12, 16)}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              panel === 'add' ? 'السبب (اختياري): شراء، توريد...' : 'السبب: تالف، جرد...'
            }
            className={inputClass}
            style={pad(12, 16)}
          />
          <button
            type="submit"
            disabled={adjust.isPending}
            className={`${primaryBtnClass} self-start`}
            style={pad(10, 20)}
          >
            {adjust.isPending
              ? 'جاري الحفظ...'
              : panel === 'add'
                ? 'تأكيد الإضافة'
                : 'تأكيد الخصم'}
          </button>
        </form>
      )}

      {panel === 'history' && (
        <div className="flex flex-col text-sm" style={{ gap: 8 }}>
          {history.isLoading && <p className="text-ink-400">جاري التحميل...</p>}
          {history.error && (
            <p className="text-brand-400">مقدرتش أحمّل السجل.</p>
          )}
          {history.data && history.data.length === 0 && (
            <p className="text-ink-400">مفيش حركات لسه.</p>
          )}
          {history.data?.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between border-t border-ink-700"
              style={{ paddingTop: 8, gap: 12 }}
            >
              <div className="min-w-0">
                <p className="truncate">
                  {m.invoice_no
                    ? `فاتورة #${m.invoice_no}`
                    : m.reason || 'تعديل يدوي'}
                </p>
                <p className="text-xs text-ink-400" style={{ marginTop: 2 }}>
                  {format(new Date(m.created_at), 'd MMMM yyyy', { locale: ar })}{' '}
                  •{' '}
                  <span dir="ltr">
                    {new Date(m.created_at).toLocaleTimeString('en-GB', {
                      timeZone: 'Africa/Cairo',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              </div>
              <span
                dir="ltr"
                className={`shrink-0 font-bold ${
                  m.change > 0 ? 'text-emerald-400' : 'text-brand-400'
                }`}
              >
                {m.change > 0 ? '+' : ''}
                {fmt(m.change)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={remove}
        disabled={deleteMutation.isPending}
        className="flex items-center self-start text-sm font-semibold text-brand-400 hover:underline disabled:opacity-60"
        style={{ gap: 4 }}
      >
        <MdDeleteOutline size={18} />
        مسح الصنف
      </button>
    </div>
  )
}

// ---------- الصفحة ----------

export default function Inventory() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchItems,
    enabled: !!branchId,
  })

  const items = data ?? []

  return (
    <div className="flex max-w-5xl flex-col" style={{ ...centerX, gap: 24 }}>
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">المخزون</h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          الرولات والأصناف في الفرع. السيلز بيخصم من هنا تلقائي مع كل فاتورة.
        </p>
      </section>

      {!branchId && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          الصفحة دي لمدير الفرع بس. ادخل بحساب مدير فرع عشان تدير المخزون.
        </p>
      )}

      {branchId && <AddItemForm />}

      {isLoading && <p className="text-ink-400">جاري التحميل...</p>}

      {error && (
        <p
          className="rounded-lg border border-brand-700 bg-brand-900/40 text-sm text-brand-100"
          style={pad(16)}
        >
          مقدرتش أحمّل المخزون. اتأكد إنك داخل بحساب مدير الفرع وإن ملفات الـ SQL
          اتشغلت.
        </p>
      )}

      {data && (
        <section className="flex flex-col" style={{ gap: 16 }}>
          <h2 className="text-xl font-bold">
            الأصناف{items.length > 0 ? ` (${items.length})` : ''}
          </h2>

          {items.length === 0 ? (
            <p className="text-ink-400">لسه مفيش أصناف، ضيف أول صنف من فوق.</p>
          ) : (
            <div className="grid md:grid-cols-2" style={{ gap: 16 }}>
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
