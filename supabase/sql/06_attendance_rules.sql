-- =====================================================
-- Brothers Protection | 06 - Attendance rules (Egypt time)
-- Run AFTER 01..05
-- 1) "today" is calculated in Egypt time (Africa/Cairo), not UTC, so the
--    attendance page works correctly right after midnight.
-- 2) Sales can only register / edit attendance for TODAY.
--    Fixing an older day is done by the branch manager.
-- =====================================================

alter table public.attendance
  alter column work_date set default ((now() at time zone 'Africa/Cairo')::date);

-- sales: update only today's rows
drop policy if exists "sales: update today's attendance" on public.attendance;
create policy "sales: update today's attendance"
  on public.attendance for update
  using (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and work_date = (now() at time zone 'Africa/Cairo')::date
  )
  with check (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and work_date = (now() at time zone 'Africa/Cairo')::date
  );

-- sales: insert only for today
drop policy if exists "sales: insert own branch" on public.attendance;
create policy "sales: insert today's attendance"
  on public.attendance for insert
  with check (
    public.app_role() = 'sales'
    and branch_id = public.app_branch()
    and work_date = (now() at time zone 'Africa/Cairo')::date
  );
