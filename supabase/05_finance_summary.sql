-- =====================================================
-- Brothers Protection | 05 - Finance summary (owner finance page)
-- Run AFTER 01..04
-- Returns one row per branch for a date range (inclusive):
--   revenue          = sum of invoices.total_price
--   job_expenses     = sum of invoice_expenses.amount   (materials, roll cost...)
--   general_expenses = sum of expenses.amount           (rent, electricity...)
--   payroll          = sum of payroll_runs.total_amount (counted by the week's end date)
-- net = revenue - job_expenses - general_expenses - payroll  (calculated in the app)
-- Dates are interpreted in Egypt time (Africa/Cairo).
-- security invoker = Row Level Security still applies: the owner sees all
-- branches, anyone else would only see their own branch.
-- =====================================================

create or replace function public.finance_summary(p_from date, p_to date)
returns table (
  branch_id         uuid,
  branch_name       text,
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
  order by b.name
$$;

revoke all on function public.finance_summary(date, date) from public, anon;
grant execute on function public.finance_summary(date, date) to authenticated;
