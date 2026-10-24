import { pad } from '../lib/spacing'

const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-950 text-base text-ink-100 ' +
  'placeholder:text-ink-400 outline-none transition text-left ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

// خانة مبلغ بالجنيه
export default function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
        style={{ ...pad(12, 16), paddingRight: 56 }}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-400">
        ج.م
      </span>
    </div>
  )
}
