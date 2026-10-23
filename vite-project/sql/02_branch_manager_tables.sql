-- =====================================================
-- Brothers Protection | 02 - Branch manager tables
-- Run AFTER 01_owner_tables.sql
-- Every table has branch_id, and RLS guarantees a branch manager
-- can only read/write rows of HIS branch. The owner sees everything.
-- =====================================================

-- 1) Employees (the place's workers) ---------------------
create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  full_name   text not null,
  daily_rate  numeric(12,2) not null default 0 check (daily_rate >= 0), -- pay per attendance day
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index employees_branch_idx on public.employees (branch_id);

-- 2) Fixed rates per car section --------------------------
create table public.service_rates (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  section     text not null check (section in ('front', 'back', 'side_one', 'side_two')),
  rate        numeric(12,2) not null check (rate >= 0),
  updated_at  timestamptz not null default now(),
  unique (branch_id, section)
);

-- 3) Inventory (rolls) ------------------------------------
create table public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  name        text not null,
  quantity    numeric(12,2) not null default 0 check (quantity >= 0),
  unit        text not null default 'roll',
  created_at  timestamptz not null default now(),
  unique (branch_id, name)
);

create table public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  item_id     uuid not null references public.inventory_items(id) on delete cascade,
  change      numeric(12,2) not null,   -- positive = added, negative = deducted
  reason      text,
  created_by  uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index inventory_movements_item_idx on public.inventory_movements (item_id);

-- 4) Expenses (general: rent, electricity, ...) -----------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null default public.app_branch() references public.branches(id),
  amount        numeric(12,2) not null check (amount > 0),
  reason        text not null,
  expense_date  date not null default current_date,
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index expenses_branch_date_idx on public.expenses (branch_id, expense_date);

-- 5) Weekly payroll (snapshot used to generate the PDF) ---
create table public.payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null default public.app_branch() references public.branches(id),
  employee_id   uuid not null references public.employees(id),
  week_start    date not null,
  week_end      date not null,
  days_worked   int not null default 0,
  days_amount   numeric(12,2) not null default 0,
  work_amount   numeric(12,2) not null default 0,
  total_amount  numeric(12,2) generated always as (days_amount + work_amount) stored,
  details       jsonb not null default '{}'::jsonb, -- per-section breakdown for the PDF
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (employee_id, week_start)
);
create index payroll_runs_branch_week_idx on public.payroll_runs (branch_id, week_start);

-- 6) Row Level Security (same rules for all tables above) -
do $$
declare
  t text;
begin
  foreach t in array array[
    'employees',
    'service_rates',
    'inventory_items',
    'inventory_movements',
    'expenses',
    'payroll_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- owner: everything, every branch
    execute format($p$
      create policy "owner: full access" on public.%I
      for all
      using (public.app_role() = 'owner')
      with check (public.app_role() = 'owner')
    $p$, t);

    -- branch manager: only his own branch (read AND write)
    execute format($p$
      create policy "branch manager: own branch only" on public.%I
      for all
      using (
        public.app_role() = 'branch_manager'
        and branch_id = public.app_branch()
      )
      with check (
        public.app_role() = 'branch_manager'
        and branch_id = public.app_branch()
      )
    $p$, t);
  end loop;
end $$;

-- =====================================================
-- TEST (recommended): create 2 branch managers in 2 different
-- branches, log in as each one, and confirm that
--   select * from expenses;
-- only returns his own branch rows, and that inserting a row with
-- the other branch's branch_id fails with an RLS error.
-- Sales access to employees / rates / inventory comes with the
-- sales file (03).
-- =====================================================
