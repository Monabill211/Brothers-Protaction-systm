import { toast } from 'sonner'
import { BRAND } from './brand'

// ---------- أدوات صغيرة ----------

export const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const num = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function longDate(iso?: string) {
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(iso ? new Date(iso) : new Date())
}

function logoUrl() {
  return typeof window === 'undefined'
    ? '/logo-badge.png'
    : `${window.location.origin}/logo-badge.png`
}

// ---------- الشكل (نفس الشكل لكل الـ PDF) ----------

export const PRINT_CSS = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0;
         font-size: 14px; line-height: 1.6; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .band { background: #0a0a0a; color: #fff; display: flex; justify-content: space-between;
          align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 4px solid #c8102e;
          border-radius: 10px 10px 0 0; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 56px; height: 56px; border-radius: 50%; display: block; }
  .brand h1 { margin: 0; font-size: 19px; letter-spacing: .4px; white-space: nowrap; }
  .brand p { margin: 2px 0 0; font-size: 12px; color: #bdbdbd; }
  .doc { text-align: left; }
  .doc strong { display: block; font-size: 18px; }
  .doc span { display: block; font-size: 12px; color: #dcdcdc; margin-top: 2px; }
  .tag { display: inline-block; margin-top: 6px; padding: 1px 12px; border: 1px solid #c8102e;
         border-radius: 999px; font-size: 11px; font-style: normal; color: #ff8d9d; }

  .cards { display: flex; gap: 12px; margin: 14px 0 4px; }
  .card { flex: 1; border: 1px solid #e3e3e3; border-radius: 10px; padding: 12px 14px;
          background: #fafafa; }
  .card .label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .card .value { font-size: 15px; font-weight: bold; }
  .card .sub { font-size: 12px; color: #666; margin-top: 2px; text-align: right; }

  h3 { font-size: 14px; margin: 16px 0 6px; padding-right: 10px; border-right: 4px solid #c8102e; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #0a0a0a; color: #fff; padding: 8px 10px; text-align: right; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e8e8e8; text-align: right; }
  tbody tr:nth-child(even) td { background: #f7f7f7; }
  tfoot td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #0a0a0a; }
  .idx { width: 36px; color: #888; }

  .summary > div { display: flex; justify-content: space-between; padding: 7px 2px;
                   border-bottom: 1px dashed #ccc; font-size: 13px; }

  .total { margin-top: 16px; display: flex; justify-content: space-between; align-items: center;
           background: #0a0a0a; color: #fff; border-radius: 10px; padding: 16px 20px;
           border-right: 6px solid #c8102e; }
  .total span { font-size: 15px; }
  .total .amount { font-size: 24px; font-weight: bold; }
  .total .pos { color: #5ee08a; }
  .total .neg { color: #ff7a7a; }

  .note { margin-top: 20px; padding: 12px 14px; border: 1px dashed #c8102e; border-radius: 10px;
          background: #fff6f7; font-size: 13px; color: #444; }
  .muted { color: #888; font-size: 13px; }
  .thanks { text-align: center; margin: 26px 0 0; color: #333; font-size: 14px; font-weight: bold; }
  .keep { text-align: center; margin: 4px 0 0; color: #777; font-size: 12px; }

  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 46px; }
  .sign div { flex: 1; text-align: center; border-top: 1px solid #999; padding-top: 6px;
              color: #555; font-size: 13px; }

  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; display: flex;
            justify-content: space-between; gap: 12px; font-size: 11px; color: #888; }
`

// ---------- قطع جاهزة ----------

// الشريط الأسود اللي فوق (اللوجو واسم الشركة ونوع المستند)
export function bandHeader(opts: {
  title: string
  subtitle?: string
  badge?: string
}) {
  return `
  <header class="band">
    <div class="brand">
      <img class="logo" src="${logoUrl()}" alt="" />
      <div>
        <h1>${esc(BRAND.name)}</h1>
        <p>${esc(BRAND.tagline)}</p>
      </div>
    </div>
    <div class="doc">
      <strong>${esc(opts.title)}</strong>
      ${opts.subtitle ? `<span>${esc(opts.subtitle)}</span>` : ''}
      ${opts.badge ? `<em class="tag">${esc(opts.badge)}</em>` : ''}
    </div>
  </header>`
}

export function footerHtml(branchName: string) {
  return `
  <footer class="footer">
    <span>${esc(branchName)}</span>
    <span>${esc(BRAND.name)} • صدر بتاريخ ${esc(longDate())}</span>
  </footer>`
}

// بيفتح نافذة الطباعة. اختار "Save as PDF" لو عايز ملف PDF.
// الطباعة بتبدأ لوحدها بعد ما اللوجو يتحمّل.
export function openPrintWindow(title: string, body: string) {
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
<style>${PRINT_CSS}</style>
</head>
<body>${body}
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.focus(); window.print(); }, 250);
  });
</script>
</body>
</html>`)
  win.document.close()
}
