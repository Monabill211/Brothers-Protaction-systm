import { centerX } from '../lib/spacing'

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="max-w-5xl" style={centerX}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-ink-400" style={{ marginTop: 8 }}>
        الصفحة دي لسه تحت التطوير.
      </p>
    </div>
  )
}
