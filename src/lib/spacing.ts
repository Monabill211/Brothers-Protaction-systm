import type { CSSProperties } from 'react'

// كل الـ padding بتتكتب inline (Tailwind للـ layout بس).
// pad(12)     -> 12px من كل الجهات
// pad(12, 16) -> 12px فوق وتحت، 16px يمين وشمال
export const pad = (v: number, h: number = v): CSSProperties => ({
  paddingTop: v,
  paddingBottom: v,
  paddingLeft: h,
  paddingRight: h,
})

// بدل mx-auto (ده margin، فبيتكتب inline)
export const centerX: CSSProperties = {
  marginLeft: 'auto',
  marginRight: 'auto',
}
