-- The reset runs some workflows as a demo user (the Finance seed prepares, approves
-- and pays payroll as the Owner). While the seed runs, sample records may change.

create or replace function {{schema}}.demo_seed_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    new.is_seed := coalesce(current_setting('corex.demo_seeding', true), '') = 'on';
    return new;
  end if;
  -- The seed itself may act as a demo user (payroll runs); it changes anything.
  if coalesce(current_setting('corex.demo_seeding', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' then
    new.is_seed := old.is_seed;
  end if;
  if not old.is_seed or (select auth.uid()) is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' or current_user = 'authenticated' then
    raise exception 'You cannot change sample records in the demo. Add your own record to try this.'
      using errcode = '42501';
  end if;
  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  if tg_table_name = 'attendance'
    or (v_new ->> 'status' = 'void' and v_old ->> 'status' is distinct from 'void')
    or (v_old ->> 'status' = 'locked' and v_new ->> 'status' is distinct from 'locked') then
    raise exception 'You cannot change sample records in the demo. Add your own record to try this.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
