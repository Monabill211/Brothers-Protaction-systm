-- =====================================================
-- Brothers Protection | 09 - Sales can log expenses
-- Run AFTER 01..08
-- Sales can:
--   * add an expense for TODAY only (Egypt time), in their own branch
--   * see and delete ONLY the expenses they entered themselves, only today
-- They can NOT see the branch manager's expenses or older entries.
-- The branch manager and the owner see everything (existing policies),
-- and these expenses are counted in "general expenses" of the finance summary.
-- =====================================================

-- "today" in Egypt time, not UTC
alter table public.expenses
  alter column expense_date set default ((now() at time zone 'Africa/Cairo')::date);

drop policy if exists "sales: insert own expenses today" on public.expenses;
create policy "sales: insert own expenses today"
  on public.expenses for insert
  with check (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and created_by = auth.uid()
    and expense_date = (now() at time zone 'Africa/Cairo')::date
  );

drop policy if exists "sales: read own expenses" on public.expenses;
create policy "sales: read own expenses"
  on public.expenses for select
  using (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and created_by = auth.uid()
  );

drop policy if exists "sales: delete own expenses today" on public.expenses;
create policy "sales: delete own expenses today"
  on public.expenses for delete
  using (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and created_by = auth.uid()
    and expense_date = (now() at time zone 'Africa/Cairo')::date
  );
