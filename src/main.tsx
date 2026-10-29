import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import './index.css'
import App from './App'
import AuthProvider from './auth/AuthProvider'
import { isSupabaseConfigured } from './lib/supabase'

const queryClient = new QueryClient()

// بتظهر لو بيانات Supabase ناقصة (بدل صفحة فاضية)
function MissingEnv() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ padding: 24 }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-brand-700 bg-ink-900"
        style={{ padding: 24 }}
      >
        <h1 className="text-xl font-bold text-brand-400">
          إعدادات Supabase ناقصة
        </h1>
        <p className="text-ink-400" style={{ marginTop: 8 }}>
          الموقع مش لاقي بيانات الاتصال بقاعدة البيانات. لازم المتغيرين دول
          يكونوا موجودين:
        </p>
        <ul
          dir="ltr"
          className="font-mono text-sm"
          style={{ marginTop: 12, paddingLeft: 20, listStyle: 'disc' }}
        >
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm text-ink-400" style={{ marginTop: 12 }}>
          على Vercel: Project Settings ← Environment Variables، وبعد ما تضيفهم
          اعمل <strong>Redeploy</strong> (المتغيرات بتتحط وقت البناء، فمن غير
          إعادة نشر مش هتتطبق). محليًا: ملف .env جنب package.json وأعد تشغيل
          npm run dev.
        </p>
        <p className="text-xs text-ink-400" style={{ marginTop: 12 }}>
          نسخة: <span dir="ltr">{__APP_VERSION__}</span>
        </p>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  isSupabaseConfigured ? (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster theme="dark" position="top-center" richColors />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  ) : (
    <MissingEnv />
  )
)
