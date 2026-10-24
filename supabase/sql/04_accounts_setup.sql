-- =====================================================
-- Brothers Protection | 04 - Accounts setup (owner settings page)
-- Run AFTER 01, 02 and 03
-- =====================================================

-- Email shown to the owner next to the password (owner-only table)
alter table public.user_credentials
  add column if not exists email text;

-- Exactly one branch manager and one sales account per branch
create unique index if not exists one_branch_manager_per_branch
  on public.profiles (branch_id) where role = 'branch_manager';

create unique index if not exists one_sales_per_branch
  on public.profiles (branch_id) where role = 'sales';
