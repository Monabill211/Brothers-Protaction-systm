import { toast } from 'sonner'
import { SECTION_LABEL } from './sections'

// أسماء ملفات اللوجو والـ QR الموجودة في فولدر public
const LOGO_BADGE = '/logo-badge.png'
const LOGO_WORDMARK = '/logo-wordmark.webp'
const QR_CODE_IMAGE = '/qr-code.png'

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
  header { display: flex; justify-content: space-between; align-items: center;
           border-bottom: 3px solid #c8102e; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-logo { width: 72px; height: 72px; object-fit: contain; }
  .brand-wordmark { height: 34px; object-fit: contain; filter: drop-shadow(0 0 1px rgba(0,0,0,0.65)); }
  h1 { margin: 0; font-size: 22px; color: #c8102e; }
  h2 { font-size: 18px; margin: 0; }
  h3 { font-size: 15px; margin: 18px 0 8px; color: #c8102e; }
  p { margin: 4px 0 0; }
  .muted { color: #666; font-size: 13px; }
  .left { text-align: left; }
  .grid { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 10px; }
  .grid > div { min-width: 220px; flex: 1; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 14px; }
  .grid > div h3 { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #ccc; padding: 10px 12px; text-align: right; }
  th { background: #f3f3f3; }
  .total { display: flex; justify-content: space-between; align-items: center;
           margin-top: 18px; padding: 14px 16px; border: 2px solid #111; border-radius: 6px; font-size: 18px; background: #fcfcfc; }
  .lines > div { display: flex; justify-content: space-between; padding: 6px 0;
                 border-bottom: 1px dashed #ccc; font-size: 14px; }
  .cert-banner { margin-top: 20px; padding: 14px 16px; background: #fdf5f6; border-right: 4px solid #c8102e;
                 border-radius: 6px; font-size: 13.5px; line-height: 1.7; color: #222; }
  .cert-banner strong { color: #c8102e; font-size: 14.5px; display: block; margin-bottom: 4px; }
  .care-box { margin-top: 16px; padding: 14px 16px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa; }
  .care-box h3 { margin: 0 0 8px; font-size: 14.5px; color: #111; }
  .care-list { margin: 0; padding-right: 18px; font-size: 13px; color: #444; line-height: 1.75; }
  .qr-section { margin-top: 20px; padding: 16px; border: 2px dashed #c8102e; border-radius: 10px;
                display: flex; align-items: center; justify-content: space-between; gap: 20px; background: #fffdfd; }
  .qr-info h3 { margin: 0 0 6px; font-size: 16px; color: #c8102e; }
  .qr-info p { margin: 0; font-size: 13px; color: #444; line-height: 1.6; }
  .qr-box { width: 115px; height: 115px; border: 1px solid #ddd; border-radius: 8px;
            display: flex; align-items: center; justify-content: center; background: #fff; padding: 6px; flex-shrink: 0; }
  .qr-box img { width: 100%; height: 100%; object-fit: contain; }
  .signatures { margin-top: 26px; display: flex; justify-content: space-between; gap: 24px; text-align: center; font-size: 13px; color: #444; }
  .signatures > div { flex: 1; padding-top: 8px; }
  .sig-line { margin-top: 32px; border-bottom: 1px dashed #999; }
  .thanks { margin-top: 24px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 12px; }
`

function openPrint(title: string, body: string) {
  const win = window.open('', '_blank')
  if (!win) {
    toast.error('المتصفح منع النافذة. اسمح بالـ pop-ups للموقع وجرّب تاني')
    return
  }

  const origin = window.location.origin

  win.document.open()
  win.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<base href="${esc(origin)}/" />
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`)
  win.document.close()
  win.focus()
  // في نافذة الطباعة اختار "Save as PDF" لو عايز ملف PDF
  setTimeout(() => win.print(), 500)
}

function header(inv: PrintableInvoice, title: string) {
  const origin = window.location.origin
  return `
  <header>
    <div class="brand">
      <img src="${esc(origin + LOGO_BADGE)}" alt="Brothers Logo" class="brand-logo" onerror="this.style.display='none'" />
      <div>
        <img src="${esc(origin + LOGO_WORDMARK)}" alt="Brothers" class="brand-wordmark" onerror="this.style.display='none'" />
        <h1>Brothers Car Protection</h1>
        <p class="muted">${esc(inv.branchName)}</p>
      </div>
    </div>
    <div class="left">
      <h2>${esc(title)} #${inv.invoiceNo}</h2>
      <p class="muted">${esc(dateLabel(inv.createdAt))}</p>
    </div>
  </header>`
}

// فاتورة العميل (التاريخ، بيانات العميل، بيانات العربية، اسم الرول/الخدمة، الإجمالي، و QR تفعيل الكود)
export function printCustomerInvoice(inv: PrintableInvoice) {
  const origin = window.location.origin

  // اسم الرول المسحوب من المخزون (أو البنود المكتوبة يدوياً في الفاتورة العادية لو مفيش رول محدد)
  const rollOrServiceName =
    inv.itemName ||
    (inv.lines && inv.lines.length > 0
      ? inv.lines.map((l) => l.description).filter(Boolean).join(' ، ')
      : '') ||
    '—'

  openPrint(
    `فاتورة ${inv.invoiceNo}`,
    `${header(inv, 'فاتورة')}

    <div class="grid">
      <div>
        <h3>بيانات العميل</h3>
        <p><strong>الاسم:</strong> ${esc(inv.customerName || '—')}</p>
        ${
          inv.customerPhone
            ? `<p><strong>الهاتف:</strong> <span dir="ltr">${esc(inv.customerPhone)}</span></p>`
            : ''
        }
      </div>
      <div>
        <h3>بيانات العربية</h3>
        <p><strong>الموديل:</strong> ${esc(inv.carModel || '—')}</p>
        <p><strong>رقم اللوحة:</strong> ${esc(inv.plate || '—')}</p>
      </div>
    </div>

    <h3>بيانات الخدمة / الرول</h3>
    <table>
      <thead><tr><th>اسم الرول / الخدمة المنفذة</th><th>الفرع المنفذ</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>${esc(rollOrServiceName)}</strong></td>
          <td>${esc(inv.branchName || 'Brothers Car Protection')}</td>
        </tr>
      </tbody>
    </table>

    ${inv.notes ? `<h3>ملاحظات</h3><p>${esc(inv.notes)}</p>` : ''}

    <div class="total">
      <span>الإجمالي</span>
      <strong dir="ltr">${num(inv.price)} ج.م</strong>
    </div>

    <div class="cert-banner">
      <strong>✔ تم التركيب بواسطة فروع براذرز (Brothers Car Protection) المعتمدة</strong>
      تم تركيب وتنفيذ (<strong>${esc(rollOrServiceName)}</strong>) داخل فروع  Brothers المعتمدة على يد فنيين متخصصين وباستخدام خامات ورولات أصلية معتمدة وفق أعلى معايير الجودة وحماية السيارات، وقد تم فحص السيارة ومراجعتها بالكامل قبل التسليم.
    </div>

    <div class="care-box">
      <h3>إرشادات العناية والحفاظ على الحماية</h3>
      <ul class="care-list">
        <li>يُرجى عدم غسل السيارة بالماء المضغوط أو المواد الكيميائية القوية خلال أول 72 ساعة من التركيب.</li>
        <li>يُنصح بمراجعة الفرع بعد أسبوع من التركيب لإجراء الفحص المجاني والاطمئنان على ثبات الرول وجودة التركيب.</li>
        <li>يُرجى الاحتفاظ بهذه الفاتورة وإبرازها عند زيارة أي من فروع Brothers Car Protection المعتمدة.</li>
      </ul>
    </div>

 

    <div class="signatures">
      <div>
        <span>مسؤول التسليم والفحص</span>
        <div class="sig-line"></div>
      </div>
      <div>
        <span>ختم الفرع المعتمد</span>
        <div class="sig-line"></div>
      </div>
      <div>
        <span>توقيع العميل بالاستلام</span>
        <div class="sig-line"></div>
      </div>
    </div>

    <p class="thanks">شكراً لثقتكم في Brothers Car Protection — نسعد دائماً بخدمتكم في جميع فروعنا المعتمدة</p>`
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