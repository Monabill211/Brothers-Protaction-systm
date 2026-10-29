-- =====================================================
-- Brothers Protection | 13 - Branch names + order
-- Run AFTER 01..12
-- 1) Adds a fixed `position` to every branch, so the order (1st, 2nd, 3rd)
--    no longer depends on the branch NAME. That lets the owner rename branches
--    safely.
-- 2) Renames the branches:
--      position 1 -> المهندسين
--      position 2 -> التجمع
--      position 3 -> الشيخ زايد
-- 3) finance_summary now also returns `branch_position` (the app sorts by it).
-- Safe to run more than once.
-- =====================================================

alter table public.branches
  add column if not exists position int not null default 0;

-- positions from the ORIGINAL names (only rows that still have no position)
update public.branches
   set position = case name
         when 'الفرع الأول'  then 1
         when 'الفرع الثاني' then 2
         when 'الفرع الثالث' then 3
         else 0
       end
 where position = 0;

-- anything left without a position gets the next free numbers
with ranked as (
  select id,
         row_number() over (order by created_at, id)
           + (select coalesce(max(position), 0) from public.branches) as rn
    from public.branches
   where position = 0
)
update public.branches b
   set position = r.rn
  from ranked r
 where b.id = r.id;

-- the new names (by position, so this can be re-run)
update public.branches set name = 'المهندسين'    where position = 1;
update public.branches set name = 'التجمع'     where position = 2;
update public.branches set name = 'الشيخ زايد' where position = 3;

-- finance_summary returns one more column, so it must be dropped first
drop function if exists public.finance_summary(date, date);

create or replace function public.finance_summary(p_from date, p_to date)
returns table (
  branch_id         uuid,
  branch_name       text,
  branch_position   int,
  invoices_count    bigint,
  revenue           numeric,
  job_expenses      numeric,
  general_expenses  numeric,
  payroll           numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      (p_from::timestamp at time zone 'Africa/Cairo')        as t_from,
      ((p_to + 1)::timestamp at time zone 'Africa/Cairo')    as t_to
  )
  select
    b.id,
    b.name,
    b.position,

    (select count(*)
       from public.invoices i, bounds
      where i.branch_id = b.id
        and i.created_at >= bounds.t_from and i.created_at < bounds.t_to),

    coalesce((select sum(i.total_price)
       from public.invoices i, bounds
      where i.branch_id = b.id
        and i.created_at >= bounds.t_from and i.created_at < bounds.t_to), 0),

    coalesce((select sum(e.amount)
       from public.invoice_expenses e, bounds
      where e.branch_id = b.id
        and e.created_at >= bounds.t_from and e.created_at < bounds.t_to), 0),

    coalesce((select sum(x.amount)
       from public.expenses x
      where x.branch_id = b.id
        and x.expense_date between p_from and p_to), 0),

    coalesce((select sum(p.total_amount)
       from public.payroll_runs p
      where p.branch_id = b.id
        and p.week_end between p_from and p_to), 0)

  from public.branches b
  order by b.position, b.name
$$;

revoke all on function public.finance_summary(date, date) from public, anon;
grant execute on function public.finance_summary(date, date) to authenticated;
