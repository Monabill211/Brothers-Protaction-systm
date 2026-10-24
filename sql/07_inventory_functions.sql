-- =====================================================
-- Brothers Protection | 07 - Inventory adjustment (branch manager)
-- Run AFTER 01..06
-- adjust_inventory(item, change, reason):
--   adds (+) or removes (-) stock AND records the movement in ONE step,
--   so the quantity and the history can never get out of sync.
--   Only a branch manager, only for items of his own branch,
--   and the quantity can never go below zero.
-- (Sales deduct rolls through deduct_inventory from file 03.)
-- =====================================================

create or replace function public.adjust_inventory(
  p_item_id uuid,
  p_change  numeric,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
begin
  if public.app_role() <> 'branch_manager' then
    raise exception 'not allowed';
  end if;

  if p_change is null or p_change = 0 then
    raise exception 'change must not be zero';
  end if;

  update public.inventory_items
     set quantity = quantity + p_change
   where id = p_item_id
     and branch_id = public.app_branch()
     and quantity + p_change >= 0
  returning branch_id into v_branch;

  if v_branch is null then
    raise exception 'item not found in your branch, or quantity would go below zero';
  end if;

  insert into public.inventory_movements (branch_id, item_id, change, reason, created_by)
  values (v_branch, p_item_id, p_change, nullif(trim(p_reason), ''), auth.uid());
end;
$$;

revoke all on function public.adjust_inventory(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_inventory(uuid, numeric, text) to authenticated;
