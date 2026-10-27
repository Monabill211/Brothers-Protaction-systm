-- =====================================================
-- Brothers Protection | 10 - Manual (regular) invoices
-- Run AFTER 01..09
-- A manual invoice is NOT tied to protection film or to employees' work:
-- the salesperson writes the service lines and prices by hand
-- (e.g. "غسيل عربية 150", "تلميع 300"). It is stored in the same
-- `invoices` table (kind = 'manual'), so it shows up in customer history,
-- the owner's operations page and the finance summary automatically.
-- It does NOT touch employees' pay and does NOT deduct inventory.
-- =====================================================

-- 1) invoice kind
alter table public.invoices
  add column if not exists kind text not null default 'protection'
  check (kind in ('protection', 'manual'));

-- 2) the lines written by hand
create table if not exists public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null,
  branch_id   uuid not null default public.app_branch() references public.branches(id),
  description text not null check (length(trim(description)) > 0),
  amount      numeric(12,2) not null check (amount > 0),
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  foreign key (invoice_id, branch_id)
    references public.invoices (id, branch_id) on delete cascade
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

-- 3) Row Level Security (same rules as the other invoice tables)
alter table public.invoice_lines enable row level security;

drop policy if exists "owner: full access" on public.invoice_lines;
create policy "owner: full access" on public.invoice_lines
  for all
  using (public.app_role() = 'owner')
  with check (public.app_role() = 'owner');

drop policy if exists "branch manager: own branch only" on public.invoice_lines;
create policy "branch manager: own branch only" on public.invoice_lines
  for all
  using (public.app_role() = 'branch_manager' and branch_id = public.app_branch())
  with check (public.app_role() = 'branch_manager' and branch_id = public.app_branch());

drop policy if exists "sales: read own branch" on public.invoice_lines;
create policy "sales: read own branch" on public.invoice_lines
  for select
  using (public.app_role() = 'sales' and branch_id = public.app_branch());

drop policy if exists "sales: insert own branch" on public.invoice_lines;
create policy "sales: insert own branch" on public.invoice_lines
  for insert
  with check (public.app_role() = 'sales' and branch_id = public.app_branch());

-- 4) save a whole manual invoice in ONE transaction
--    The total is calculated here from the lines (never trusted from the app).
create or replace function public.create_manual_invoice(
  p_customer_id    uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_car_model      text,
  p_plate_number   text,
  p_notes          text,
  p_lines          jsonb,   -- [{ "description": "غسيل", "amount": 150 }, ...]
  p_expenses       jsonb    -- [{ "description": "...", "amount": 20 }, ...] (optional)
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer uuid := p_customer_id;
  v_invoice  uuid;
  v_no       bigint;
  v_total    numeric;
begin
  if public.app_role() <> 'sales' then
    raise exception 'not allowed';
  end if;

  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'no lines';
  end if;

  select sum((l->>'amount')::numeric)
    into v_total
    from jsonb_array_elements(p_lines) l;

  if v_total is null or v_total <= 0 then
    raise exception 'invalid price';
  end if;

  -- customer: existing one, or create a new one
  if v_customer is null then
    if nullif(trim(p_customer_name), '') is null then
      raise exception 'customer name required';
    end if;

    insert into public.customers (name, phone)
    values (trim(p_customer_name), nullif(trim(p_customer_phone), ''))
    returning id into v_customer;
  elsif not exists (select 1 from public.customers where id = v_customer) then
    raise exception 'customer not found in your branch';
  end if;

  insert into public.invoices (customer_id, car_model, plate_number, total_price, notes, kind)
  values (
    v_customer,
    nullif(trim(p_car_model), ''),
    nullif(trim(p_plate_number), ''),
    v_total,
    nullif(trim(p_notes), ''),
    'manual'
  )
  returning id, invoice_no into v_invoice, v_no;

  insert into public.invoice_lines (invoice_id, description, amount, position)
  select v_invoice, trim(t.l->>'description'), (t.l->>'amount')::numeric, (t.ord - 1)::int
    from jsonb_array_elements(p_lines) with ordinality as t(l, ord);

  insert into public.invoice_expenses (invoice_id, description, amount)
  select v_invoice, trim(e->>'description'), (e->>'amount')::numeric
    from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) e;

  return jsonb_build_object('id', v_invoice, 'invoice_no', v_no);
end;
$$;

revoke all on function public.create_manual_invoice(uuid, text, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_manual_invoice(uuid, text, text, text, text, text, jsonb, jsonb) to authenticated;
