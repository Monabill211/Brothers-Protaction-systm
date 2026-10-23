import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { ar } from 'date-fns/locale'

export type Period = 'day' | 'week' | 'month' | 'year'

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'يومي' },
  { key: 'week', label: 'أسبوعي' },
  { key: 'month', label: 'شهري' },
  { key: 'year', label: 'سنوي' },
]

// الأسبوع بيبدأ السبت (weekStartsOn: 6)
export function getRange(period: Period, anchor: Date) {
  switch (period) {
    case 'day':
      return { from: startOfDay(anchor), to: endOfDay(anchor) }
    case 'week':
      return {
        from: startOfWeek(anchor, { weekStartsOn: 6 }),
        to: endOfWeek(anchor, { weekStartsOn: 6 }),
      }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    case 'year':
      return { from: startOfYear(anchor), to: endOfYear(anchor) }
  }
}

export function shift(period: Period, anchor: Date, dir: 1 | -1) {
  switch (period) {
    case 'day':
      return addDays(anchor, dir)
    case 'week':
      return addWeeks(anchor, dir)
    case 'month':
      return addMonths(anchor, dir)
    case 'year':
      return addYears(anchor, dir)
  }
}

export function rangeLabel(period: Period, from: Date, to: Date) {
  switch (period) {
    case 'day':
      return format(from, 'EEEE d MMMM yyyy', { locale: ar })
    case 'week':
      return `من ${format(from, 'd MMMM', { locale: ar })} إلى ${format(
        to,
        'd MMMM yyyy',
        { locale: ar }
      )}`
    case 'month':
      return format(from, 'MMMM yyyy', { locale: ar })
    case 'year':
      return format(from, 'yyyy')
  }
}
