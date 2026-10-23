-- =====================================================
-- Brothers Protection | 03 - Sales tables
-- Run AFTER 01_owner_tables.sql and 02_branch_manager_tables.sql
-- Sales can: record employee attendance, create invoices
-- (customer + internal data), deduct a roll, search customers.
-- Everything is limited to the user's own branch.
-- =====================================================

-- 0) Needed for branch-safe foreign keys ------------------
alter table public.employees
  add constraint employees_id_branch_uniq unique (id, branch_id);

-- 1) Customers --------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now(),
  unique (id, branch_id)
);
create index customers_branch_name_idx on public.customers (branch_id, name);

-- 2) Invoices (one row = customer invoice + internal invoice) --
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    bigint generated always as identity,
  branch_id     uuid not null default public.app_branch() references public.branches(id),
  customer_id   uuid not null,
  car_model     text,
  plate_number  text,
  total_price   numeric(12,2) not null check (total_price >= 0),
  notes         text,
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (id, branch_id),
  foreign key (customer_id, branch_id) references public.customers (id, branch_id)
);
create index invoices_branch_date_idx on public.invoices (branch_id, created_at);
create index invoices_customer_idx    on public.invoices (customer_id);

-- 3) Who did what (internal invoice) ------------------------
create table public.invoice_work (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null,
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  employee_id uuid not null,
  section     text not null check (section in ('front', 'back', 'side_one', 'side_two')),
  rate        numeric(12,2) not null check (rate >= 0), -- snapshot of the rate at that time
  created_at  timestamptz not null default now(),
  foreign key (invoice_id, branch_id)  references public.invoices  (id, branch_id) on delete cascade,
  foreign key (employee_id, branch_id) references public.employees (id, branch_id)
);
create index invoice_work_invoice_idx  on public.invoice_work (invoice_id);
create index invoice_work_employee_idx on public.invoice_work (employee_id);

-- 4) Job expenses (materials, roll cost, ...) ---------------
create table public.invoice_expenses (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null,
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  foreign key (invoice_id, branch_id) references public.invoices (id, branch_id) on delete cascade
);
create index invoice_expenses_invoice_idx on public.invoice_expenses (invoice_id);

-- 5) Daily attendance of the place's employees --------------
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  employee_id uuid not null,
  work_date   date not null default current_date,
  check_in    timestamptz,
  check_out   timestamptz,
  created_by  uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (employee_id, work_date),
  check (check_out is null or check_in is null or check_out >= check_in),
  foreign key (employee_id, branch_id) references public.employees (id, branch_id)
);
create index attendance_branch_date_idx on public.attendance (branch_id, work_date);

-- 6) Auto-fill the rate from service_rates if not sent ------
create or replace function public.set_work_rate()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.rate is null then
    select rate into new.rate
    from public.service_rates
    where branch_id = new.branch_id and section = new.section;
  end if;
  return new;
end;
$$;

create trigger invoice_work_set_rate
  before insert on public.invoice_work
  for each row execute function public.set_work_rate();

-- 7) Link inventory movements to invoices -------------------
alter table public.inventory_movements
  add column invoice_id uuid references public.invoices(id);

-- 8) Deduct a roll (sales can't edit inventory directly) ----
create or replace function public.deduct_inventory(
  p_item_id    uuid,
  p_qty        numeric default 1,
  p_invoice_id uuid default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_branch uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be positive';
  end if;

  if public.app_role() not in ('sales', 'branch_manager') then
    raise exception 'not allowed';
  end if;

  if p_invoice_id is not null and not exists (
    select 1 from public.invoices
    where id = p_invoice_id and branch_id = public.app_branch()
  ) then
    raise exception 'invoice not found in your branch';
  end if;

  update public.inventory_items
     set quantity = quantity - p_qty
   where id = p_item_id
     and branch_id = public.app_branch()
     and quantity >= p_qty
  returning branch_id into v_branch;

  if v_branch is null then
    raise exception 'item not found in your branch, or not enough stock';
  end if;

  insert into public.inventory_movements (branch_id, item_id, change, reason, invoice_id, created_by)
  values (v_branch, p_item_id, -p_qty, 'used in invoice', p_invoice_id, auth.uid());
end;
$$;

revoke all on function public.deduct_inventory(uuid, numeric, uuid) from public, anon;
grant execute on function public.deduct_inventory(uuid, numeric, uuid) to authenticated;

-- 9) Row Level Security -------------------------------------
-- 9a) owner + branch manager on the new tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'invoices',
    'invoice_work',
    'invoice_expenses',
    'attendance'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$
      create policy "owner: full access" on public.%I
      for all
      using (public.app_role() = 'owner')
      with check (public.app_role() = 'owner')
    $p$, t);

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

-- 9b) sales: READ own branch
do $$
declare
  t text;
begin
  foreach t in array array[
    'employees',
    'service_rates',
    'inventory_items',
    'customers',
    'invoices',
    'invoice_work',
    'invoice_expenses',
    'attendance'
  ]
  loop
    execute format($p$
      create policy "sales: read own branch" on public.%I
      for select
      using (
        public.app_role() = 'sales'
        and branch_id = public.app_branch()
      )
    $p$, t);
  end loop;
end $$;

-- 9c) sales: INSERT own branch
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'invoices',
    'invoice_work',
    'invoice_expenses',
    'attendance'
  ]
  loop
    execute format($p$
      create policy "sales: insert own branch" on public.%I
      for insert
      with check (
        public.app_role() = 'sales'
        and branch_id = public.app_branch()
      )
    $p$, t);
  end loop;
end $$;

-- 9d) sales: UPDATE (customers any time, attendance same day only)
create policy "sales: update own customers"
  on public.customers for update
  using (public.app_role() = 'sales' and branch_id = public.app_branch())
  with check (public.app_role() = 'sales' and branch_id = public.app_branch());

create policy "sales: update today's attendance"
  on public.attendance for update
  using (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and work_date = current_date
  )
  with check (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
  );

-- Note: sales has NO delete rights, and no direct access to
-- inventory_movements / payroll_runs / expenses.
