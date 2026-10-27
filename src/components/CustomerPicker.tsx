import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { MdSearch } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import { pad } from '../lib/spacing'
import { cleanTerm } from '../lib/search'

export type CustomerHit = { id: string; name: string; phone: string | null }

// Tailwind للـ layout والألوان بس، والـ padding/margin/gap كلها inline
const cardClass = 'rounded-2xl border border-ink-700 bg-ink-900'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

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

// ---------- قسم العميل (جديد / موجود) ----------

export default function CustomerPicker({
  mode,
  onModeChange,
  picked,
  onPick,
  name,
  onNameChange,
  phone,
  onPhoneChange,
}: {
  mode: 'new' | 'existing'
  onModeChange: (mode: 'new' | 'existing') => void
  picked: CustomerHit | null
  onPick: (customer: CustomerHit | null) => void
  name: string
  onNameChange: (v: string) => void
  phone: string
  onPhoneChange: (v: string) => void
}) {
  const toggleBtn = (active: boolean) =>
    `flex-1 rounded-lg text-sm font-semibold transition ${
      active
        ? 'bg-brand-600 text-white'
        : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
    }`

  return (
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
          onClick={() => onModeChange('new')}
          className={toggleBtn(mode === 'new')}
          style={pad(8, 8)}
        >
          عميل جديد
        </button>
        <button
          type="button"
          onClick={() => onModeChange('existing')}
          className={toggleBtn(mode === 'existing')}
          style={pad(8, 8)}
        >
          عميل موجود
        </button>
      </div>

      {mode === 'new' ? (
        <div className="grid sm:grid-cols-2" style={{ gap: 12 }}>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="اسم العميل"
            className={inputClass}
            style={pad(12, 16)}
          />
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
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
            onClick={() => onPick(null)}
            className="shrink-0 text-sm font-semibold text-brand-400 hover:underline"
          >
            تغيير
          </button>
        </div>
      ) : (
        <CustomerSearch onPick={onPick} />
      )}
    </section>
  )
}
