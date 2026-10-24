-- =====================================================
-- Brothers Protection | 08 - create_invoice (sales "new invoice" page)
-- Run AFTER 01..07
-- Saves a whole invoice in ONE transaction:
--   customer (new or existing) + invoice + who did what + job expenses
--   + roll deduction from inventory.
-- If any step fails, NOTHING is saved (no half-made invoices).
-- Sales only, own branch only (security invoker = RLS still applies).
-- Returns { id, invoice_no }.
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
  if public.app_role() <> 'sales' then
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
