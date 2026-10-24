// الأرقام العربية -> إنجليزي، عشان البحث برقم التليفون يشتغل
export function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

// شيل الرموز اللي بتبوّظ فلتر البحث في Supabase
export function cleanTerm(s: string) {
  return normalizeDigits(s).replace(/[,()%*\\"]/g, ' ').trim()
}
