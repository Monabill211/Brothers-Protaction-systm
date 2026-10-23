// تنسيق الفلوس: 12,500 ج.م
export function money(n: number) {
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م`
}

// بيقبل الأرقام العربي (١٢٣) والإنجليزي (123) وفاصلة عشرية , أو .
// بيرجّع null لو الرقم مش صحيح أو سالب
export function parseAmount(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace('٫', '.')
    .replace(',', '.')
  if (normalized === '') return null
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}
