-- =====================================================
-- Brothers Protection | 01 - Owner (الاونر) tables
-- Run this whole file in: Supabase > SQL Editor
-- =====================================================

-- 1) Branches ------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

insert into public.branches (name) values
  ('الفرع الأول'),
  ('الفرع الثاني'),
  ('الفرع الثالث');

-- 2) Profiles (every user: owner / branch_manager / sales) --
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('owner', 'branch_manager', 'sales')),
  branch_id   uuid references public.branches(id),
  created_at  timestamptz not null default now(),
  -- owner has no branch; everyone else must have one
  constraint branch_required check (role = 'owner' or branch_id is not null)
);

create index profiles_branch_idx on public.profiles (branch_id);

-- 3) Credentials (so the owner can see passwords) -------
create table public.user_credentials (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  password_plain text not null,
  updated_at     timestamptz not null default now()
);

-- 4) Helper functions (security definer = no RLS recursion) --
create or replace function public.app_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.app_branch()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid()
$$;

-- 5) Row Level Security --------------------------------
alter table public.branches         enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_credentials enable row level security;

-- branches
create policy "owner: full access to branches"
  on public.branches for all
  using (public.app_role() = 'owner')
  with check (public.app_role() = 'owner');

create policy "users: read own branch"
  on public.branches for select
  using (id = public.app_branch());

-- profiles
create policy "owner: full access to profiles"
  on public.profiles for all
  using (public.app_role() = 'owner')
  with check (public.app_role() = 'owner');

create policy "users: read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "branch manager: read profiles of own branch"
  on public.profiles for select
  using (
    public.app_role() = 'branch_manager'
    and branch_id = public.app_branch()
  );

-- user_credentials (owner only)
create policy "owner: full access to credentials"
  on public.user_credentials for all
  using (public.app_role() = 'owner')
  with check (public.app_role() = 'owner');

-- =====================================================
-- FIRST OWNER (one time only)
-- 1. Supabase > Authentication > Users > Add user (email + password)
-- 2. Copy that user's UUID and run the block below
--    (the SQL Editor bypasses RLS, so this works)
-- =====================================================
-- insert into public.profiles (id, full_name, role)
-- values ('PUT-OWNER-UUID-HERE', 'اسم الاونر', 'owner');
--
-- insert into public.user_credentials (user_id, password_plain)
-- values ('PUT-OWNER-UUID-HERE', 'THE-PASSWORD-YOU-SET');
