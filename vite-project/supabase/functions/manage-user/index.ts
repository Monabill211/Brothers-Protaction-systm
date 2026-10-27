// Supabase Edge Function: manage-user
// Owner-only. Creates a branch manager / sales account, or changes a password.
// Uses the service_role key, which exists ONLY on the server (injected by Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2'

type Admin = ReturnType<typeof createClient>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const STAFF_ROLES = ['branch_manager', 'sales']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'غير مصرح' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) مين اللي بيطلب؟
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'غير مصرح' }, 401)
    const callerId = userData.user.id

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 2) لازم يكون مناجر (owner)
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single()
    if (callerProfile?.role !== 'owner') {
      return json({ error: 'الصفحة دي للمناجر بس' }, 403)
    }

    const body = await req.json()
    if (body?.action === 'create') return await createAccount(admin, body)
    if (body?.action === 'set-password') {
      return await setPassword(admin, callerId, body)
    }
    return json({ error: 'طلب غير معروف' }, 400)
  } catch (err) {
    console.error(err)
    return json({ error: 'حصل خطأ في السيرفر' }, 500)
  }
})

async function createAccount(admin: Admin, body: Record<string, unknown>) {
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.full_name ?? '').trim()
  const role = String(body.role ?? '')
  const branchId = String(body.branch_id ?? '')

  if (!fullName) return json({ error: 'اكتب اسم الحساب' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'الإيميل مش مظبوط' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'الباسورد لازم يكون 6 حروف على الأقل' }, 400)
  }
  if (!STAFF_ROLES.includes(role)) return json({ error: 'دور غير صحيح' }, 400)

  const { data: branch } = await admin
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .maybeSingle()
  if (!branch) return json({ error: 'الفرع مش موجود' }, 400)

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('branch_id', branchId)
    .eq('role', role)
    .maybeSingle()
  if (existing) {
    return json({ error: 'الحساب ده موجود بالفعل للفرع ده' }, 409)
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createError || !created.user) {
    const alreadyUsed = createError?.message?.toLowerCase().includes('already')
    return json(
      { error: alreadyUsed ? 'الإيميل ده مستخدم قبل كده' : 'مقدرتش أعمل الحساب' },
      400
    )
  }
  const userId = created.user.id

  // لو أي خطوة فشلت نمسح يوزر Auth (والباقي بيتمسح معاه بالـ cascade)
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: userId, full_name: fullName, role, branch_id: branchId })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return json({ error: 'مقدرتش أسجل بيانات الحساب' }, 500)
  }

  const { error: credError } = await admin
    .from('user_credentials')
    .insert({ user_id: userId, email, password_plain: password })
  if (credError) {
    await admin.auth.admin.deleteUser(userId)
    return json({ error: 'مقدرتش أحفظ الباسورد' }, 500)
  }

  return json({ ok: true, user_id: userId })
}

async function setPassword(
  admin: Admin,
  callerId: string,
  body: Record<string, unknown>
) {
  const userId = String(body.user_id ?? '')
  const password = String(body.password ?? '')

  if (password.length < 6) {
    return json({ error: 'الباسورد لازم يكون 6 حروف على الأقل' }, 400)
  }

  const { data: target } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return json({ error: 'الحساب مش موجود' }, 404)

  // الاونر يغيّر باسورد مدير الفرع والسيلز وباسورده هو بس
  const allowed = STAFF_ROLES.includes(target.role) || target.id === callerId
  if (!allowed) return json({ error: 'مينفعش تغيّر باسورد الحساب ده' }, 403)

  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return json({ error: 'مقدرتش أغيّر الباسورد' }, 400)

  const { error: credError } = await admin.from('user_credentials').upsert({
    user_id: userId,
    password_plain: password,
    updated_at: new Date().toISOString(),
  })
  if (credError) {
    return json(
      { error: 'الباسورد اتغيّر بس مقدرتش أحدّث النسخة المعروضة' },
      500
    )
  }

  return json({ ok: true })
}
