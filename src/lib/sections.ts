// كل أجزاء وخدمات الشغل اللي ليها نسبة للموظف. مصدر واحد بتستخدمه كل الصفحات.
// لو ضفت خدمة جديدة: ضيفها هنا، وفي قيد الـ CHECK في قاعدة البيانات (ملف 11).
export type Section =
  | 'front'
  | 'back'
  | 'side_one'
  | 'side_two'
  | 'half_insulation'
  | 'full_insulation'
  | 'remove_install'

export const SECTIONS: { key: Section; label: string }[] = [
  { key: 'front', label: 'الوش' },
  { key: 'back', label: 'الضهر' },
  { key: 'side_one', label: 'جنب واحد' },
  { key: 'side_two', label: 'جنب اتنين' },
  { key: 'half_insulation', label: 'نص عزل' },
  { key: 'full_insulation', label: 'عزل كامل' },
  { key: 'remove_install', label: 'فك وتركيب' },
]

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s.label])
)

export const SECTION_ORDER: string[] = SECTIONS.map((s) => s.key)

// أجزاء العربية اللي الفاتورة بتكتبها "حماية ..."
const PROTECTION_PARTS: string[] = ['front', 'back', 'side_one', 'side_two']

// اسم الخدمة زي ما يظهر على فاتورة العميل
export function serviceName(section: string) {
  const label = SECTION_LABEL[section] ?? section
  return PROTECTION_PARTS.includes(section) ? `حماية ${label}` : label
}

// كائن فيه كل الأجزاء بنفس القيمة (للـ state الابتدائي)
export function bySection<T>(value: T): Record<Section, T> {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, value])) as Record<
    Section,
    T
  >
}
