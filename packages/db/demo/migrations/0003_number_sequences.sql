-- Counters are not sample records (Clinic demo): registering a patient bumps the
-- year's patient number counter, which the seed created. Counter tables are left out
-- of the sample-record guard, like document_sequences and student_number_sequences.

create or replace function {{schema}}.demo_prepare()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_table text;
begin
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = '{{schema}}'
      and c.relkind = 'r'
      and c.relname not in (
        '_migrations', 'audit_events', 'settings', 'memberships', 'demo_rate_limits'
      )
      and c.relname not like '%\_sequences'
  loop
    execute format(
      'alter table {{schema}}.%I add column if not exists is_seed boolean not null default false',
      v_table
    );
    if not exists (
      select 1 from pg_trigger
      where tgrelid = format('{{schema}}.%I', v_table)::regclass and tgname = 'demo_seed_guard'
    ) then
      execute format(
        'create trigger demo_seed_guard before insert or update or delete on {{schema}}.%I
         for each row execute function {{schema}}.demo_seed_guard()',
        v_table
      );
    end if;
  end loop;
  -- Added to counter tables by the first version of this function.
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_trigger t on t.tgrelid = c.oid and t.tgname = 'demo_seed_guard'
    where n.nspname = '{{schema}}' and c.relname like '%\_sequences'
  loop
    execute format('drop trigger demo_seed_guard on {{schema}}.%I', v_table);
  end loop;
end;
$$;

select {{schema}}.demo_prepare();
