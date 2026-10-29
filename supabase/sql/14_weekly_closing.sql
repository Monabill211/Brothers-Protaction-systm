-- =====================================================
-- Brothers Protection | 14 - Weekly closing (branch manager)
-- Run AFTER 01..13
-- A weekly closing is a saved snapshot of ALL the money that came in and went
-- out of ONE branch during ONE week (Saturday -> Friday, Egypt time):
--   IN : invoices                         (invoices.total_price)
--   OUT: job expenses                     (invoice_expenses)
--        general expenses                 (expenses, entered by manager or sales)
--        employees' pay                   (approved payroll_runs of that week)
--   NET = IN - OUT
-- The numbers are calculated by the DATABASE (never trusted from the app).
-- A week can be closed only when every employee's pay for it is approved and
-- up to date. It can be re-closed (snapshot refreshed) if something changes.
-- Safe to run more than once.
-- =====================================================

create table if not exists public.weekly_closings (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  week_start       date not null,
  week_end         date not null,
  invoices_count   int  not null default 0,
  revenue          numeric(12,2) not null default 0,
  job_expenses     numeric(12,2) not null default 0,
  general_expenses numeric(12,2) not null default 0,
  payroll          numeric(12,2) not null default 0,
  net              numeric(12,2) generated always as
                   (revenue - job_expenses - general_expenses - payroll) stored,
  notes            text,
  closed_by        uuid references public.profiles(id),
  closed_at        timestamptz not null default now(),
  unique (branch_id, week_start)
);

alter table public.weekly_closings enable row level security;

-- read only: nobody writes this table directly, only close_week() does
drop policy if exists "owner: read closings" on public.weekly_closings;
create policy "owner: read closings" on public.weekly_closings
  for select using (public.app_role() = 'owner');

drop policy if exists "branch manager: read own closings" on public.weekly_closings;
create policy "branch manager: read own closings" on public.weekly_closings
  for select using (
    public.app_role() = 'branch_manager' and branch_id = public.app_branch()
  );

-- internal calculator (not callable from the app)
create or replace function public.weekly_totals(p_branch uuid, p_from date, p_to date)
returns table (
  invoices_count       bigint,
  revenue              numeric,
  manual_revenue       numeric,
  job_expenses         numeric,
  general_expenses     numeric,
  payroll              numeric,
  payroll_employees    bigint,
  unapproved_employees bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select (p_from::timestamp at time zone 'Africa/Cairo')     as t_from,
           ((p_to + 1)::timestamp at time zone 'Africa/Cairo') as t_to
  ),
  live as (
    select e.id,
           e.daily_rate,
           (select count(distinct a.work_date)
              from public.attendance a
             where a.employee_id = e.id and a.branch_id = p_branch
               and a.check_in is not null
               and a.work_date between p_from and p_to) as days,
           coalesce((select sum(w.rate)
              from public.invoice_work w, b
             where w.employee_id = e.id and w.branch_id = p_branch
               and w.created_at >= b.t_from and w.created_at < b.t_to), 0) as work_amount
      from public.employees e
     where e.branch_id = p_branch
  ),
  calc as (
    select id,
           days * daily_rate + work_amount as live_total,
           (days > 0 or work_amount > 0)   as active
      from live
  )
  select
    (select count(*) from public.invoices i, b
      where i.branch_id = p_branch
        and i.created_at >= b.t_from and i.created_at < b.t_to),

    coalesce((select sum(i.total_price) from public.invoices i, b
      where i.branch_id = p_branch
        and i.created_at >= b.t_from and i.created_at < b.t_to), 0),

    coalesce((select sum(i.total_price) from public.invoices i, b
      where i.branch_id = p_branch and i.kind = 'manual'
        and i.created_at >= b.t_from and i.created_at < b.t_to), 0),

    coalesce((select sum(x.amount) from public.invoice_expenses x, b
      where x.branch_id = p_branch
        and x.created_at >= b.t_from and x.created_at < b.t_to), 0),

    coalesce((select sum(x.amount) from public.expenses x
      where x.branch_id = p_branch
        and x.expense_date between p_from and p_to), 0),

    coalesce((select sum(r.total_amount) from public.payroll_runs r
      where r.branch_id = p_branch and r.week_start = p_from), 0),

    (select count(*) from public.payroll_runs r
      where r.branch_id = p_branch and r.week_start = p_from),

    (select count(*) from calc c
      where c.active
        and not exists (
          select 1 from public.payroll_runs r
           where r.employee_id = c.id and r.week_start = p_from
             and r.total_amount = c.live_total))
$$;

revoke all on function public.weekly_totals(uuid, date, date) from public, anon, authenticated;

-- live numbers for the page (the caller's own branch, one week)
create or replace function public.branch_weekly_totals(p_week_start date)
returns table (
  invoices_count       bigint,
  revenue              numeric,
  manual_revenue       numeric,
  job_expenses         numeric,
  general_expenses     numeric,
  payroll              numeric,
  payroll_employees    bigint,
  unapproved_employees bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.app_role() <> 'branch_manager' then
    raise exception 'not allowed';
  end if;
  if extract(dow from p_week_start) <> 6 then
    raise exception 'week must start on Saturday';
  end if;

  return query
    select * from public.weekly_totals(public.app_branch(), p_week_start, p_week_start + 6);
end;
$$;

revoke all on function public.branch_weekly_totals(date) from public, anon;
grant execute on function public.branch_weekly_totals(date) to authenticated;

-- close (or re-close) a week
create or replace function public.close_week(p_week_start date, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid := public.app_branch();
  t        record;
  v_id     uuid;
begin
  if public.app_role() <> 'branch_manager' then
    raise exception 'not allowed';
  end if;
  if extract(dow from p_week_start) <> 6 then
    raise exception 'week must start on Saturday';
  end if;

  select * into t from public.weekly_totals(v_branch, p_week_start, p_week_start + 6);

  if t.unapproved_employees > 0 then
    raise exception 'unapproved payroll';
  end if;

  insert into public.weekly_closings
    (branch_id, week_start, week_end, invoices_count, revenue,
     job_expenses, general_expenses, payroll, notes, closed_by, closed_at)
  values
    (v_branch, p_week_start, p_week_start + 6, t.invoices_count, t.revenue,
     t.job_expenses, t.general_expenses, t.payroll, nullif(trim(p_notes), ''), auth.uid(), now())
  on conflict (branch_id, week_start) do update
    set invoices_count   = excluded.invoices_count,
        revenue          = excluded.revenue,
        job_expenses     = excluded.job_expenses,
        general_expenses = excluded.general_expenses,
        payroll          = excluded.payroll,
        notes            = excluded.notes,
        closed_by        = excluded.closed_by,
        closed_at        = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.close_week(date, text) from public, anon;
grant execute on function public.close_week(date, text) to authenticated;
