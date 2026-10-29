import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// بصمة النسخة: رقم الـ commit (Vercel بيحطه) ووقت البناء بتوقيت مصر.
// بتظهر في صفحة الدخول وفي آخر القايمة، عشان تعرف النسخة المنشورة هي أنهي واحدة.
const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)
const builtAt = new Date().toLocaleString('en-GB', {
  timeZone: 'Africa/Cairo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(`${sha} • ${builtAt}`),
  },
})
