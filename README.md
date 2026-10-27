# Brothers Protection — نظام الإدارة

React + Vite + TypeScript + Tailwind v4 + Supabase.
ثلاث أدوار: **الاونر (owner)** و**مدير الفرع (branch)** و**السيلز (branch-sells)**، وثلاث فروع كل فرع معزول عن التاني.

## تشغيل محلي

```bash
npm install          # فيه .npmrc بيحل مشكلة ERESOLVE تلقائي
cp .env.example .env # وحط بيانات Supabase بتاعتك
npm run dev
```

`.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

ماتحطش مفتاح `service_role` / `secret` هنا أبدًا، أي متغير بيبدأ بـ `VITE_` بيظهر في المتصفح.

## Supabase

1. في **SQL Editor** شغّل الملفات اللي في `supabase/sql/` بالترتيب (01 → 13)، واحد واحد.
2. اعمل يوزر الاونر من Authentication ← Users ← Add user (فعّل Auto Confirm User)، وبعدين شغّل:

```sql
insert into public.profiles (id, full_name, role)
values ('UUID-بتاع-اليوزر', 'الاونر', 'owner');

insert into public.user_credentials (user_id, email, password_plain)
values ('UUID-بتاع-اليوزر', 'email@example.com', 'الباسورد');
```

3. ارفع الـ Edge Function الموجودة في `supabase/functions/manage-user/index.ts`
   (Edge Functions ← Deploy a new function ← Via Editor، وقفل Verify JWT).
   الـ Dashboard بيدّيها اسم تلقائي (مثلاً `rapid-responder`)، فلو اسمها مختلف عن اللي في
   `src/pages/owner/Settings.tsx` (دالة `callManageUser`) غيّر الاسم هناك.
   أي تعديل في كود الـ Function لازم ترفعه تاني (Edge Functions ← الـ Function ← Code ← Deploy updates).
4. من صفحة **الإعدادات** عند الاونر اعمل حساب مدير الفرع وحساب السيلز لكل فرع.

## النشر على Vercel

- الإعدادات تلقائية (Vite). ملف `vercel.json` بيخلّي الروابط زي `/owner` تشتغل عند الريفريش.
- من Project Settings ← **Environment Variables** ضيف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`، وبعدها **Redeploy**.
  من غيرهم الموقع بيفتح فاضي.
- `VITE_DEV_ROLE` للتطوير بس، ماتحطهوش على Vercel.

## الصفحات

| الدور | المسار | الصفحة |
|---|---|---|
| الاونر | `/owner/finance` | الملخصات المالية (يومي/أسبوعي/شهري/سنوي لكل فرع) |
| الاونر | `/owner/operations` | العمليات (كل الفواتير: مين عمل إيه والصافي) |
| الاونر | `/owner/settings` | حسابات مدير الفرع والسيلز لكل فرع، وتعديل الاسم والإيميل والباسورد (حسابهم وحساب الاونر نفسه) |
| مدير الفرع | `/branch/employees` | الموظفين واليومية، ونسب الوش والضهر والجنب ونص عزل وعزل كامل وفك وتركيب |
| مدير الفرع | `/branch/payroll` | القبض الأسبوعي (اعتماد + طباعة PDF) |
| مدير الفرع | `/branch/expenses` | المصروفات مع السبب |
| مدير الفرع | `/branch/inventory` | المخزون وحركته |
| مدير الفرع | `/branch/new-invoice` | فاتورة جديدة (نفس صفحة السيلز: حماية أو عادية يدوي) |
| السيلز | `/branch-sells/new-invoice` | فاتورة جديدة: **فاتورة حماية** (عميل + شغل + مصروفات + خصم رول) أو **فاتورة عادية يدوي** (بنود وأسعار بتتكتب بالإيد) |
| السيلز | `/branch-sells/attendance` | حضور وانصراف الموظفين |
| السيلز | `/branch-sells/expenses` | تسجيل مصروفات النهارده (بيشوفها مدير الفرع والاونر) |
| السيلز | `/branch-sells/customers` | البحث عن عميل وفواتيره القديمة |

## ملاحظات للتطوير

- Tailwind للـ layout والألوان فقط، وكل الـ padding والـ margin والـ gap بتتكتب inline (`style`)، ومعاك helper في `src/lib/spacing.ts`.
- صلاحيات الفروع بتتطبق من قاعدة البيانات (RLS)، مش من الواجهة بس.
- وضع التجربة: ضيف `VITE_DEV_ROLE=owner` في `.env` وشغّل `npm run dev` عشان تشوف صفحات دور من غير دخول (ملوش بيانات حقيقية).
