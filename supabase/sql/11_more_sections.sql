-- =====================================================
-- Brothers Protection | 11 - More work sections / services
-- Run AFTER 01..10
-- Adds three services that employees get a fixed rate for:
--   half_insulation = نص عزل
--   full_insulation = عزل كامل
--   remove_install  = فك وتركيب
-- (the existing four stay: front, back, side_one, side_two)
-- Safe to run more than once. Existing data is not touched.
-- =====================================================

-- drop the old CHECK on "section" (whatever its name is), in both tables
do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in ('public.service_rates'::regclass, 'public.invoice_work'::regclass)
       and pg_get_constraintdef(oid) ilike '%section%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.service_rates
  add constraint service_rates_section_check
  check (section in (
    'front', 'back', 'side_one', 'side_two',
    'half_insulation', 'full_insulation', 'remove_install'
  ));

alter table public.invoice_work
  add constraint invoice_work_section_check
  check (section in (
    'front', 'back', 'side_one', 'side_two',
    'half_insulation', 'full_insulation', 'remove_install'
  ));
