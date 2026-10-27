-- =====================================================
-- Brothers Protection | 12 - Branch manager can create invoices too
-- Run AFTER 01..11
-- Until now only SALES could create invoices. This replaces the two
-- functions so a BRANCH MANAGER can also create:
--   * create_invoice         (protection invoice: who did what, expenses, roll)
--   * create_manual_invoice  (regular invoice written by hand)
-- Everything else is unchanged: same branch isolation (RLS), same one-step
-- save (nothing is saved if any part fails). The owner still cannot create
-- invoices (he has no branch). Safe to run more than once.
-- =====================================================

create or replace function public.create_invoice(
  p_customer_id    uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_car_model      text,
  p_plate_number   text,
  p_total_price    numeric,
  p_notes          text,
  p_work           jsonb,   -- [{ "employee_id": "...", "section": "front" }, ...]
  p_expenses       jsonb,   -- [{ "description": "...", "amount": 100 }, ...]
  p_item_id        uuid,    -- inventory item to deduct (nullable)
  p_item_qty       numeric  -- quantity to deduct (default 1)
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
begin
  if public.app_role() not in ('sales', 'branch_manager') then
    raise exception 'not allowed';
  end if;

  if p_total_price is null or p_total_price <= 0 then
    raise exception 'invalid price';
  end if;

  if jsonb_array_length(coalesce(p_work, '[]'::jsonb)) = 0 then
    raise exception 'no work selected';
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

  -- every selected section must have a rate set by the branch manager
  if exists (
    select 1
      from jsonb_array_elements(p_work) w
     where not exists (
       select 1 from public.service_rates r
        where r.branch_id = public.app_branch()
          and r.section = w->>'section'
     )
  ) then
    raise exception 'missing service rate';
  end if;

  insert into public.invoices (customer_id, car_model, plate_number, total_price, notes)
  values (
    v_customer,
    nullif(trim(p_car_model), ''),
    nullif(trim(p_plate_number), ''),
    p_total_price,
    nullif(trim(p_notes), '')
  )
  returning id, invoice_no into v_invoice, v_no;

  -- who did what (the rate is copied from service_rates by a trigger)
  insert into public.invoice_work (invoice_id, employee_id, section)
  select v_invoice, (w->>'employee_id')::uuid, w->>'section'
    from jsonb_array_elements(p_work) w;

  -- job expenses
  insert into public.invoice_expenses (invoice_id, description, amount)
  select v_invoice, trim(e->>'description'), (e->>'amount')::numeric
    from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb)) e;

  -- roll deduction
  if p_item_id is not null then
    perform public.deduct_inventory(p_item_id, coalesce(p_item_qty, 1), v_invoice);
  end if;

  return jsonb_build_object('id', v_invoice, 'invoice_no', v_no);
end;
$$;

revoke all on function public.create_invoice(uuid, text, text, text, text, numeric, text, jsonb, jsonb, uuid, numeric) from public, anon;
grant execute on function public.create_invoice(uuid, text, text, text, text, numeric, text, jsonb, jsonb, uuid, numeric) to authenticated;

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
  if public.app_role() not in ('sales', 'branch_manager') then
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
