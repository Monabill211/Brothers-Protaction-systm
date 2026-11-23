import { format, subMonths } from 'date-fns'
import { supabase } from './supabase'
import { getRange } from './periods'
import { SECTION_ORDER } from './sections'

export type ServiceAlert = {
  id: string
  invoice_no: number
  kind: string
  car_model: string | null
  plate_number: string | null
  car_year: number | null
  car_color: string | null
  total_price: number
  notes: string | null
  created_at: string
  customer_name: string
  customer_phone: string | null
  sections: string[]
  lines: { description: string; amount: number }[]
}

function one<T>(v: unknown): T | undefined {
  return (Array.isArray(v) ? v[0] : v) as T | undefined
}

export function weekServiceWindow(anchor: Date) {
  const { from, to } = getRange('week', anchor)
  return {
    weekFrom: from,
    weekTo: to,
    serviceFrom: subMonths(from, 3),
    serviceTo: subMonths(to, 3),
  }
}

export function parseServiceAlert(r: Record<string, unknown>): ServiceAlert {
  const customer = one<{ name?: string; phone?: string | null }>(r.customers)
  const work = (r.invoice_work ?? []) as { section: string }[]
  const sections = [...new Set(work.map((w) => w.section))].sort(
    (a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)
  )
  const lines = ((r.invoice_lines ?? []) as Record<string, unknown>[])
    .slice()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((l) => ({
      description: String(l.description),
      amount: Number(l.amount),
    }))

  return {
    id: String(r.id),
    invoice_no: Number(r.invoice_no),
    kind: String(r.kind ?? 'protection'),
    car_model: (r.car_model as string | null) ?? null,
    plate_number: (r.plate_number as string | null) ?? null,
    car_year: r.car_year == null ? null : Number(r.car_year),
    car_color: (r.car_color as string | null) ?? null,
    total_price: Number(r.total_price),
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    customer_name: customer?.name ?? '—',
    customer_phone: customer?.phone ?? null,
    sections,
    lines,
  }
}

export async function fetchWeekServiceAlerts(
  anchor: Date
): Promise<ServiceAlert[]> {
  const { serviceFrom, serviceTo } = weekServiceWindow(anchor)

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_no, kind, car_model, plate_number, car_year, car_color, total_price, notes, created_at, ' +
        'customers(name, phone), ' +
        'invoice_work(section), ' +
        'invoice_lines(description, amount, position)'
    )
    .gte('created_at', serviceFrom.toISOString())
    .lte('created_at', serviceTo.toISOString())
    .order('created_at', { ascending: true })
  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(
    parseServiceAlert
  )
}

export function weekKey(anchor: Date) {
  const { weekFrom } = weekServiceWindow(anchor)
  return format(weekFrom, 'yyyy-MM-dd')
}
