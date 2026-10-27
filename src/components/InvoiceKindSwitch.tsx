import { pad } from '../lib/spacing'

export type InvoiceKind = 'protection' | 'manual'

// اختيار نوع الفاتورة: حماية (بأجزاء العربية والموظفين) أو عادية (بنود بتتكتب بإيد السيلز)
export default function InvoiceKindSwitch({
  kind,
  onChange,
}: {
  kind: InvoiceKind
  onChange: (kind: InvoiceKind) => void
}) {
  const btn = (active: boolean) =>
    `flex-1 rounded-lg text-sm font-semibold transition ${
      active
        ? 'bg-brand-600 text-white'
        : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
    }`

  return (
    <div
      className="flex rounded-xl border border-ink-700 bg-ink-900 sm:max-w-md"
      style={{ ...pad(4), gap: 4 }}
    >
      <button
        type="button"
        onClick={() => onChange('protection')}
        className={btn(kind === 'protection')}
        style={pad(10, 8)}
      >
        فاتورة حماية
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={btn(kind === 'manual')}
        style={pad(10, 8)}
      >
        فاتورة عادية (يدوي)
      </button>
    </div>
  )
}
