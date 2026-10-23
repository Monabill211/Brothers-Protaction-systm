# Brothers Protection

React + Vite + TypeScript + Tailwind v4 + Supabase.

## 1) Install

```bash
npm create vite@latest brothers-protection -- --template react-ts
cd brothers-protection
npm install
npm i tailwindcss @tailwindcss/vite @supabase/supabase-js @tanstack/react-query react-router-dom react-hook-form zod @hookform/resolvers @tanstack/react-table recharts date-fns sonner clsx tailwind-merge @fontsource/cairo react-icons --legacy-peer-deps
```

Then copy the files of this folder over the project (replace existing ones)
and delete `src/App.css`.

## 2) Environment

Copy `.env.example` to `.env` and fill:

- `VITE_SUPABASE_URL`: Supabase > Project Settings > API > Project URL
- `VITE_SUPABASE_ANON_KEY`: same page > `anon` `public` key

Never put the `service_role` key in a `VITE_` variable.

## 3) Database

Run in Supabase > SQL Editor, in this order:

1. `sql/01_owner_tables.sql`
2. `sql/02_branch_manager_tables.sql`
3. `sql/03_sales_tables.sql`

Then create the first owner (instructions at the end of file 01).

## 4) Run

```bash
npm run dev
```

## Structure

```
src/
  auth/
    roles.ts            roles + home route of each role
    auth-context.ts     context, types, useAuth()
    AuthProvider.tsx    session + profile (role, branch)
    ProtectedRoute.tsx  route guard by role
  lib/supabase.ts       Supabase client
  pages/Login.tsx       login page
  App.tsx               routes
  main.tsx              providers
```
