-- Demo-only layer (SPEC.md 11.3). Applied after the product migrations to the public
-- demo schemas only (demo_college, demo_highschool, demo_clinic, demo_finance), never
-- to a client schema. It adds:
-- - `is_seed` on every data table: seeded sample records can be viewed but not edited,
--   voided or deleted by visitors; their own new records can be, until the nightly reset.
-- - Settings and memberships locked against visitors (the apps also hide those screens).
-- - Rate-limit counters for logins and writes.
-- - Demo sign-ins protected from password and email changes through the Auth API.

-- Rate limits ---------------------------------------------------------------------

create table {{schema}}.demo_rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table {{schema}}.demo_rate_limits enable row level security;
revoke all on {{schema}}.demo_rate_limits from public, anon, authenticated;

-- Counts one hit for `p_key` in the current fixed window; true while within the limit.
create function {{schema}}.demo_rate_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into {{schema}}.demo_rate_limits as r (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  delete from {{schema}}.demo_rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end;
$$;

-- Called by the app server with the service-role key (logins are counted per IP).
grant execute on function {{schema}}.demo_rate_hit(text, integer, integer) to service_role;

-- 60 writes per signed-in user per minute; the app checks it before each action.
create function {{schema}}.demo_write_allowed()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  return {{schema}}.demo_rate_hit('write:' || (select auth.uid())::text, 60, 60);
end;
$$;

grant execute on function {{schema}}.demo_write_allowed() to authenticated;

-- Sample records ------------------------------------------------------------------

-- Rows inserted while `corex.demo_seeding` is on (the seed script) are sample records.
-- A visitor (any request with a signed-in user) cannot edit or delete them directly.
-- Workflow functions may still move them along (approve a submitted plan, record a
-- payment against a sample invoice), but not void them, correct attendance or reopen
-- published results.
create function {{schema}}.demo_seed_guard()
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

-- Adds `is_seed` and the guard to every data table. Idempotent: the reset calls it
-- again so tables added by later product migrations are covered too.
create function {{schema}}.demo_prepare()
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
        '_migrations', 'audit_events', 'settings', 'memberships', 'document_sequences',
        'student_number_sequences', 'demo_rate_limits'
      )
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
end;
$$;

select {{schema}}.demo_prepare();

-- Settings and users --------------------------------------------------------------

create function {{schema}}.demo_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'You cannot change % in the demo.',
      case tg_table_name when 'settings' then 'settings' else 'users or roles' end
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger demo_locked before insert or update or delete on {{schema}}.settings
  for each row execute function {{schema}}.demo_locked();
create trigger demo_locked before insert or update or delete on {{schema}}.memberships
  for each row execute function {{schema}}.demo_locked();

-- Demo sign-ins -------------------------------------------------------------------

-- The demo password is published, so a visitor must not be able to change it (or the
-- email) through the Auth API with their session. Supabase Auth connects as
-- supabase_auth_admin; for this schema's members the old values are kept, so the
-- request succeeds without effect. The reset script sets passwords directly in SQL.
create function {{schema}}.demo_protect_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user = 'supabase_auth_admin'
    and exists (select 1 from {{schema}}.memberships m where m.user_id = old.id) then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.phone := old.phone;
  end if;
  return new;
end;
$$;

create trigger demo_protect_account_{{schema}} before update on auth.users
  for each row execute function {{schema}}.demo_protect_account();
