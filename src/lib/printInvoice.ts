import { toast } from 'sonner'
import { SECTION_LABEL, serviceName } from './sections'

export type PrintableInvoice = {
  invoiceNo: number
  createdAt: string
  branchName: string
  customerName: string
  customerPhone: string
  carModel: string
  plate: string
  price: number
  notes: string
  work: { employee: string; section: string; rate: number }[]
  expenses: { description: string; amount: number }[]
  itemName: string | null
  itemQty: number
  // فاتورة عادية (يدوي): البنود اللي اتكتبت بإيد السيلز
  lines?: { description: string; amount: number }[]
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(iso))
}

const STYLE = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; color: #111; margin: 0; padding: 8px; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 3px solid #c8102e; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 22px; color: #c8102e; }
  h2 { font-size: 18px; margin: 0; }
  h3 { font-size: 15px; margin: 18px 0 8px; }
  p { margin: 4px 0 0; }
  .muted { color: #666; font-size: 13px; }
  .left { text-align: left; }
  .grid { display: flex; gap: 24px; flex-wrap: wrap; }
  .grid > div { min-width: 200px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
  th { background: #f3f3f3; }
  .total { display: flex; justify-content: space-between; align-items: center;
           margin-top: 22px; padding: 14px 16px; border: 2px solid #111; font-size: 18px; }
  .lines > div { display: flex; justify-content: space-between; padding: 6px 0;
                 border-bottom: 1px dashed #ccc; font-size: 14px; }
  .thanks { margin-top: 40px; text-align: center; color: #666; font-size: 13px; }
`

function openPrint(title: string, body: string) {
  const win = window.open('', '_blank')
  if (!win) {
    toast.error('المتصفح منع النافذة. اسمح بالـ pop-ups للموقع وجرّب تاني')
    return
  }

  win.document.open()
  win.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`)
  win.document.close()
  win.focus()
  // في نافذة الطباعة اختار "Save as PDF" لو عايز ملف PDF
  setTimeout(() => win.print(), 400)
}

function header(inv: PrintableInvoice, title: string) {
  return `
  <header>
    <div>
      <h1>Brothers Car Protection</h1>
      <p class="muted">${esc(inv.branchName)}</p>
    </div>
    <div class="left">
      <h2>${esc(title)} #${inv.invoiceNo}</h2>
      <p class="muted">${esc(dateLabel(inv.createdAt))}</p>
    </div>
  </header>`
}

// فاتورة العميل
export function printCustomerInvoice(inv: PrintableInvoice) {
  const sections = [...new Set(inv.work.map((w) => w.section))]
  const car = [inv.carModel, inv.plate].filter(Boolean).join(' - ')

  openPrint(
    `فاتورة ${inv.invoiceNo}`,
    `${header(inv, 'فاتورة')}

    <div class="grid">
      <div>
        <h3>بيانات العميل</h3>
        <p>${esc(inv.customerName)}</p>
        ${inv.customerPhone ? `<p dir="ltr" style="text-align:right">${esc(inv.customerPhone)}</p>` : ''}
      </div>
      <div>
        <h3>العربية</h3>
        <p>${car ? esc(car) : '—'}</p>
      </div>
    </div>

    <h3>الخدمات</h3>
    ${
      inv.lines && inv.lines.length > 0
        ? `<table>
      <thead><tr><th>الخدمة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.lines
          .map(
            (l) =>
              `<tr><td>${esc(l.description)}</td><td dir="ltr">${num(l.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : `<table>
      <thead><tr><th>الخدمة</th></tr></thead>
      <tbody>
        ${sections
          .map((s) => `<tr><td>${esc(serviceName(s))}</td></tr>`)
          .join('')}
      </tbody>
    </table>`
    }

    ${inv.notes ? `<h3>ملاحظات</h3><p>${esc(inv.notes)}</p>` : ''}

    <div class="total">
      <span>الإجمالي</span>
      <strong dir="ltr">${num(inv.price)} ج.م</strong>
    </div>

    <p class="thanks">شكراً لثقتكم في Brothers Car Protection</p>`
  )
}

// الفاتورة الداخلية (لمدير الفرع والمناجر)
export function printInternalInvoice(inv: PrintableInvoice) {
  const expensesTotal = inv.expenses.reduce((s, e) => s + e.amount, 0)
  const workCost = inv.work.reduce((s, w) => s + w.rate, 0)
  const net = inv.price - expensesTotal - workCost

  openPrint(
    `فاتورة داخلية ${inv.invoiceNo}`,
    `${header(inv, 'فاتورة داخلية')}

    <div class="grid">
      <div>
        <h3>العميل</h3>
        <p>${esc(inv.customerName)}</p>
      </div>
      <div>
        <h3>العربية</h3>
        <p>${esc([inv.carModel, inv.plate].filter(Boolean).join(' - ') || '—')}</p>
      </div>
    </div>

    ${
      inv.lines && inv.lines.length > 0
        ? `<h3>بنود الفاتورة (فاتورة عادية)</h3>
    <table>
      <thead><tr><th>البند</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.lines
          .map(
            (l) =>
              `<tr><td>${esc(l.description)}</td><td dir="ltr">${num(l.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : ''
    }

    ${
      inv.work.length > 0
        ? `<h3>مين عمل إيه</h3>
    <table>
      <thead><tr><th>الموظف</th><th>الجزء</th><th>النسبة</th></tr></thead>
      <tbody>
        ${inv.work
          .map(
            (w) =>
              `<tr><td>${esc(w.employee)}</td><td>${esc(
                SECTION_LABEL[w.section] ?? w.section
              )}</td><td dir="ltr">${num(w.rate)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : ''
    }

    <h3>مصروفات الشغل</h3>
    ${
      inv.expenses.length
        ? `<table>
      <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.expenses
          .map(
            (e) =>
              `<tr><td>${esc(e.description)}</td><td dir="ltr">${num(e.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : '<p class="muted">مفيش مصروفات.</p>'
    }

    ${
      inv.itemName
        ? `<h3>المخزون</h3><p>اتخصم ${num(inv.itemQty)} من: ${esc(inv.itemName)}</p>`
        : ''
    }

    <h3>الحساب</h3>
    <div class="lines">
      <div><span>سعر الفاتورة</span><span dir="ltr">${num(inv.price)}</span></div>
      <div><span>مصروفات الشغل</span><span dir="ltr">${num(expensesTotal)}</span></div>
      ${
        inv.work.length > 0
          ? `<div><span>نسب الموظفين</span><span dir="ltr">${num(workCost)}</span></div>`
          : ''
      }
    </div>

    <div class="total">
      <span>صافي العملية</span>
      <strong dir="ltr">${num(net)} ج.م</strong>
    </div>`
  )
}
