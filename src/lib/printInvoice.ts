import { SECTION_LABEL, serviceName } from './sections'
import { BRAND } from './brand'
import {
  bandHeader,
  esc,
  footerHtml,
  longDate,
  num,
  openPrintWindow,
} from './printTheme'

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

const carOf = (inv: PrintableInvoice) =>
  [inv.carModel, inv.plate].filter(Boolean).join(' - ')

// ---------- فاتورة العميل ----------

export function customerInvoiceHtml(inv: PrintableInvoice) {
  const sections = [...new Set(inv.work.map((w) => w.section))]
  const car = carOf(inv)

  const services =
    inv.lines && inv.lines.length > 0
      ? `<table>
      <thead><tr><th class="idx">#</th><th>الخدمة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.lines
          .map(
            (l, i) =>
              `<tr><td class="idx">${i + 1}</td><td>${esc(
                l.description
              )}</td><td dir="ltr">${num(l.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
      : `<table>
      <thead><tr><th class="idx">#</th><th>الخدمة</th></tr></thead>
      <tbody>
        ${sections
          .map(
            (s, i) =>
              `<tr><td class="idx">${i + 1}</td><td>${esc(serviceName(s))}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`

  return `
  <section class="page">
    ${bandHeader({
      title: `فاتورة رقم #${inv.invoiceNo}`,
      subtitle: longDate(inv.createdAt),
    })}

    <div class="cards">
      <div class="card">
        <div class="label">العميل</div>
        <div class="value">${esc(inv.customerName)}</div>
        ${
          inv.customerPhone
            ? `<div class="sub" dir="ltr">${esc(inv.customerPhone)}</div>`
            : ''
        }
      </div>
      <div class="card">
        <div class="label">العربية</div>
        <div class="value">${car ? esc(car) : '—'}</div>
      </div>
    </div>

    <h3>الخدمات</h3>
    ${services}

    ${
      inv.notes
        ? `<div class="note"><strong>ملاحظات:</strong> ${esc(inv.notes)}</div>`
        : ''
    }

    <div class="total">
      <span>الإجمالي المستحق</span>
      <span class="amount" dir="ltr">${num(inv.price)} ج.م</span>
    </div>

    <p class="thanks">${esc(BRAND.invoiceThanks)}</p>
    <p class="keep">${esc(BRAND.invoiceKeep)}</p>

    ${footerHtml(inv.branchName)}
  </section>`
}

// ---------- الفاتورة الداخلية (لمدير الفرع والمناجر) ----------

export function internalInvoiceHtml(inv: PrintableInvoice) {
  const expensesTotal = inv.expenses.reduce((s, e) => s + e.amount, 0)
  const workCost = inv.work.reduce((s, w) => s + w.rate, 0)
  const net = inv.price - expensesTotal - workCost
  const car = carOf(inv)

  const linesTable =
    inv.lines && inv.lines.length > 0
      ? `<h3>بنود الفاتورة (فاتورة عادية)</h3>
    <table>
      <thead><tr><th class="idx">#</th><th>البند</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.lines
          .map(
            (l, i) =>
              `<tr><td class="idx">${i + 1}</td><td>${esc(
                l.description
              )}</td><td dir="ltr">${num(l.amount)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`
      : ''

  const workTable =
    inv.work.length > 0
      ? `<h3>مين عمل إيه</h3>
    <table>
      <thead><tr><th>الموظف</th><th>الجزء / الخدمة</th><th>النسبة</th></tr></thead>
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
      <tfoot><tr><td colspan="2">إجمالي نسب الموظفين</td><td dir="ltr">${num(
        workCost
      )}</td></tr></tfoot>
    </table>`
      : ''

  const expensesTable =
    inv.expenses.length > 0
      ? `<table>
      <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${inv.expenses
          .map(
            (e) =>
              `<tr><td>${esc(e.description)}</td><td dir="ltr">${num(
                e.amount
              )}</td></tr>`
          )
          .join('')}
      </tbody>
      <tfoot><tr><td>إجمالي المصروفات</td><td dir="ltr">${num(
        expensesTotal
      )}</td></tr></tfoot>
    </table>`
      : '<p class="muted">مفيش مصروفات على العملية دي.</p>'

  return `
  <section class="page">
    ${bandHeader({
      title: `فاتورة داخلية #${inv.invoiceNo}`,
      subtitle: longDate(inv.createdAt),
      badge: 'للاستخدام الداخلي',
    })}

    <div class="cards">
      <div class="card">
        <div class="label">العميل</div>
        <div class="value">${esc(inv.customerName)}</div>
      </div>
      <div class="card">
        <div class="label">العربية</div>
        <div class="value">${car ? esc(car) : '—'}</div>
      </div>
      <div class="card">
        <div class="label">سعر الفاتورة</div>
        <div class="value" dir="ltr" style="text-align:right">${num(inv.price)} ج.م</div>
      </div>
    </div>

    ${linesTable}
    ${workTable}

    <h3>مصروفات الشغل</h3>
    ${expensesTable}

    ${
      inv.itemName
        ? `<h3>المخزون</h3><p>اتخصم <strong dir="ltr">${num(
            inv.itemQty
          )}</strong> من: ${esc(inv.itemName)}</p>`
        : ''
    }

    <h3>الحساب</h3>
    <div class="summary">
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
      <span class="amount ${net >= 0 ? 'pos' : 'neg'}" dir="ltr">${num(net)} ج.م</span>
    </div>

    <p class="keep">${esc(BRAND.internalNote)}</p>

    ${footerHtml(inv.branchName)}
  </section>`
}

// ---------- طباعة ----------

export function printCustomerInvoice(inv: PrintableInvoice) {
  openPrintWindow(`فاتورة ${inv.invoiceNo}`, customerInvoiceHtml(inv))
}

export function printInternalInvoice(inv: PrintableInvoice) {
  openPrintWindow(`فاتورة داخلية ${inv.invoiceNo}`, internalInvoiceHtml(inv))
}
