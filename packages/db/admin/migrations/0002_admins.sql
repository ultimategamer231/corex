-- Corex Admin team and sign-in (SPEC-ADMIN.md 3, 4; PROGRESS.md Admin A1). One role:
-- every active admin can do everything. An admin signs in with an email or username
-- and a password, then a code from an authenticator app (or a device they trusted
-- for 30 days). Until then the session reads nothing (AUTH-01): the core access
-- helpers are replaced below by "active admin with a verified, current session".

create function {{schema}}.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function {{schema}}.set_updated_at() from public, anon, authenticated;

create table {{schema}}.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  -- Sign-in name, also for admins without an email address of their own.
  username text not null unique check (username ~ '^[a-z][a-z0-9._-]{2,31}$'),
  name text not null check (length(trim(name)) between 2 and 100),
  -- Real email, for password reset by email. Lowercase.
  email text unique check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invited_by uuid references {{schema}}.admins (id),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- A signed-in browser session that passed the second step. Keyed by the Supabase
-- JWT session_id claim, so the same check works in middleware, server code and
-- row-level security.
create table {{schema}}.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null unique,
  method text not null check (method in ('authenticator', 'trusted_device')),
  verified_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index admin_sessions_user_idx on {{schema}}.admin_sessions (user_id);

-- "Trust this device for 30 days" (AUTH-06). Only a SHA-256 hash of the cookie's
-- random token is kept.
create table {{schema}}.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index trusted_devices_user_idx on {{schema}}.trusted_devices (user_id);

-- One-time links: invites (72 hours), password resets and authenticator set-up.
-- Only a SHA-256 hash of the link's token is kept.
create table {{schema}}.admin_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references {{schema}}.admins (id),
  kind text not null check (kind in ('invite', 'password_reset', 'authenticator_setup')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index admin_tokens_admin_idx on {{schema}}.admin_tokens (admin_id);

-- Every email the admin tries to send (SPEC-ADMIN.md 4, 9.6).
create table {{schema}}.email_log (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  cc text,
  subject text not null,
  template text not null,
  entity_type text,
  entity_id text,
  resend_id text,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped_disabled')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index email_log_created_at_idx on {{schema}}.email_log (created_at desc);

alter table {{schema}}.admins enable row level security;
alter table {{schema}}.admin_sessions enable row level security;
alter table {{schema}}.trusted_devices enable row level security;
alter table {{schema}}.admin_tokens enable row level security;
alter table {{schema}}.email_log enable row level security;

create trigger admins_updated_at before update on {{schema}}.admins
  for each row execute function {{schema}}.set_updated_at();
create trigger admin_sessions_updated_at before update on {{schema}}.admin_sessions
  for each row execute function {{schema}}.set_updated_at();
create trigger trusted_devices_updated_at before update on {{schema}}.trusted_devices
  for each row execute function {{schema}}.set_updated_at();
create trigger admin_tokens_updated_at before update on {{schema}}.admin_tokens
  for each row execute function {{schema}}.set_updated_at();
create trigger email_log_updated_at before update on {{schema}}.email_log
  for each row execute function {{schema}}.set_updated_at();

-- Session inactivity limit in minutes (AUTH-05), from Settings. Default 4 hours.
create function {{schema}}.admin_timeout_minutes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.config ->> 'session_timeout_minutes')::integer from {{schema}}.settings s),
    240
  );
$$;

-- True only for an active admin whose current session passed the second step, is
-- not revoked and has been used within the inactivity limit (AUTH-01, AUTH-05).
create function {{schema}}.current_admin_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from {{schema}}.admins a
    join {{schema}}.admin_sessions s on s.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and a.status = 'active'
      and s.session_id::text = (select auth.jwt() ->> 'session_id')
      and s.revoked_at is null
      and s.last_seen_at > now() - make_interval(mins => {{schema}}.admin_timeout_minutes())
  );
$$;

revoke execute on function {{schema}}.admin_timeout_minutes() from public, anon;
revoke execute on function {{schema}}.current_admin_ok() from public, anon;
grant execute on function {{schema}}.admin_timeout_minutes() to authenticated, service_role;
grant execute on function {{schema}}.current_admin_ok() to authenticated, service_role;

-- One role (SPEC-ADMIN.md 1): the core helpers that policies use all mean "verified
-- admin" here, so the core settings, audit and billing policies apply unchanged.
create or replace function {{schema}}.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.current_admin_ok();
$$;

create or replace function {{schema}}.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.current_admin_ok();
$$;

create or replace function {{schema}}.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.current_admin_ok();
$$;

create or replace function {{schema}}.current_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when {{schema}}.current_admin_ok() then array['admin'] else '{}'::text[] end;
$$;

create or replace function {{schema}}.billing_roles()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['admin'];
$$;

-- Called by the middleware on every request (AUTH-01, AUTH-05). Returns
--   'ok', 'unverified' (second step not done), 'expired' (inactive too long; the
--   session is ended), or 'not_admin'.
-- Refreshes last_seen_at at most once a minute.
create function {{schema}}.admin_session_state()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session_id text := (select auth.jwt() ->> 'session_id');
  v_status text;
  v_session {{schema}}.admin_sessions%rowtype;
begin
  if v_uid is null then
    return 'not_admin';
  end if;
  select a.status into v_status from {{schema}}.admins a where a.user_id = v_uid;
  if v_status is distinct from 'active' then
    return 'not_admin';
  end if;
  select * into v_session
  from {{schema}}.admin_sessions s
  where s.session_id::text = v_session_id and s.user_id = v_uid and s.revoked_at is null;
  if not found then
    return 'unverified';
  end if;
  if v_session.last_seen_at <= now() - make_interval(mins => {{schema}}.admin_timeout_minutes()) then
    update {{schema}}.admin_sessions set revoked_at = now() where id = v_session.id;
    return 'expired';
  end if;
  if v_session.last_seen_at < now() - interval '1 minute' then
    update {{schema}}.admin_sessions set last_seen_at = now() where id = v_session.id;
  end if;
  return 'ok';
end;
$$;

revoke execute on function {{schema}}.admin_session_state() from public, anon;
grant execute on function {{schema}}.admin_session_state() to authenticated;

-- AUTH-07: removing an admin is final, ends their sessions and trusted devices and
-- voids their open links. The last active admin cannot be removed.
create function {{schema}}.admins_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Admins are never deleted; remove them instead' using errcode = '23514';
  end if;
  if old.status = 'removed' and new.status <> 'removed' then
    raise exception 'A removed admin cannot be restored; invite them again' using errcode = '23514';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'An admin''s account cannot change' using errcode = '23514';
  end if;
  if old.status <> 'removed' and new.status = 'removed' then
    perform pg_advisory_xact_lock(hashtext('corex.admins.{{schema}}'));
    if old.status = 'active' and not exists (
      select 1 from {{schema}}.admins a where a.status = 'active' and a.id <> old.id
    ) then
      raise exception 'The last admin cannot be removed' using errcode = '23514';
    end if;
    new.removed_at := now();
  end if;
  return new;
end;
$$;

create trigger admins_guard
  before update or delete on {{schema}}.admins
  for each row execute function {{schema}}.admins_guard();

create function {{schema}}.admins_after_remove()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update {{schema}}.admin_sessions set revoked_at = now()
  where user_id = new.user_id and revoked_at is null;
  update {{schema}}.trusted_devices set revoked_at = now()
  where user_id = new.user_id and revoked_at is null;
  update {{schema}}.admin_tokens set expires_at = now()
  where admin_id = new.id and used_at is null and expires_at > now();
  return new;
end;
$$;

create trigger admins_after_remove
  after update on {{schema}}.admins
  for each row
  when (old.status <> 'removed' and new.status = 'removed')
  execute function {{schema}}.admins_after_remove();

revoke execute on function {{schema}}.admins_guard() from public, anon, authenticated;
revoke execute on function {{schema}}.admins_after_remove() from public, anon, authenticated;

-- Fixed-window failure counts for sign-in limits (AUTH-04), read without counting.
create function {{schema}}.rate_limit_hits(p_key text, p_window_seconds integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.hits from {{schema}}.rate_limits r
    where r.key = p_key
      and r.window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
  ), 0);
$$;

revoke execute on function {{schema}}.rate_limit_hits(text, integer) from public, anon, authenticated;
grant execute on function {{schema}}.rate_limit_hits(text, integer) to service_role;

-- Access: verified admins read the team, sessions and email log. Every write to
-- these tables is made by server code with the service role after its own checks.
create policy admins_read on {{schema}}.admins
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy admin_sessions_read on {{schema}}.admin_sessions
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy email_log_read on {{schema}}.email_log
  for select to authenticated using ((select {{schema}}.current_admin_ok()));

revoke insert, update, delete on {{schema}}.admins from authenticated;
revoke insert, update, delete on {{schema}}.admin_sessions from authenticated;
revoke insert, update, delete on {{schema}}.email_log from authenticated;
revoke all on {{schema}}.trusted_devices from authenticated;
revoke all on {{schema}}.admin_tokens from authenticated;

-- Every change is in the activity log (SPEC-ADMIN.md 5.1). A session's minute-by-
-- minute last_seen_at is not history; its start and end are.
select {{schema}}.enable_audit('{{schema}}.admins');
select {{schema}}.enable_audit('{{schema}}.trusted_devices');
select {{schema}}.enable_audit('{{schema}}.admin_tokens');
create trigger audit_row after insert or delete on {{schema}}.admin_sessions
  for each row execute function {{schema}}.audit_row();
create trigger audit_row_revoke after update on {{schema}}.admin_sessions
  for each row
  when (old.revoked_at is distinct from new.revoked_at)
  execute function {{schema}}.audit_row();

-- Corex's own settings row (SPEC-ADMIN.md 4). Company details, invoicing and the
-- other sections are filled in from Settings.
insert into {{schema}}.settings (org_name, timezone, config)
values ('Corex Digital Solutions', 'Africa/Monrovia', '{"session_timeout_minutes": 240}'::jsonb)
on conflict (id) do nothing;
