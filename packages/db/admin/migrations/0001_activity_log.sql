-- Corex Admin activity log (SPEC-ADMIN.md 5), in corex_web. The core audit_events
-- table is extended rather than duplicated: who and where, a readable summary, the
-- admin area, and a hash chain (LOG-02). Nobody can change or remove an entry,
-- including service_role (LOG-01). Corrections are new entries (LOG-03).

alter table {{schema}}.audit_events
  drop constraint audit_events_action_check,
  add constraint audit_events_action_check check (action ~ '^[a-z][a-z_]*$'),
  add column seq bigint,
  add column actor_type text not null default 'admin'
    check (actor_type in ('admin', 'system', 'website', 'client_link')),
  add column area text
    check (area in ('sign_in', 'leads', 'clients', 'invoices', 'payments', 'subscriptions', 'settings', 'team', 'system')),
  add column summary text,
  add column ip text,
  add column user_agent text,
  add column prev_hash text,
  add column row_hash text;

-- Rows written before this migration (none on a new schema) keep their order and
-- start the chain without a hash.
alter table {{schema}}.audit_events disable trigger audit_events_append_only;
update {{schema}}.audit_events e
set seq = o.n, area = 'system'
from (select id, row_number() over (order by created_at, id) as n from {{schema}}.audit_events) o
where o.id = e.id;
alter table {{schema}}.audit_events enable trigger audit_events_append_only;

alter table {{schema}}.audit_events
  alter column seq set not null,
  alter column area set not null;
create unique index audit_events_seq_idx on {{schema}}.audit_events (seq);
create index audit_events_area_idx on {{schema}}.audit_events (area, created_at desc);
create index audit_events_actor_idx on {{schema}}.audit_events (actor_id, created_at desc);

-- Admin area of a table's changes.
create function {{schema}}.audit_area(p_table_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_table_name in ('admin_sessions') then 'sign_in'
    when p_table_name in ('admins', 'trusted_devices', 'admin_tokens', 'memberships') then 'team'
    when p_table_name in ('leads', 'lead_activities') then 'leads'
    when p_table_name in ('clients', 'client_contacts', 'contracts', 'deployments', 'client_documents', 'files')
      then 'clients'
    when p_table_name in ('invoices', 'invoice_lines', 'receipts') then 'invoices'
    when p_table_name = 'payments' then 'payments'
    when p_table_name = 'subscriptions' then 'subscriptions'
    when p_table_name in ('settings', 'price_list_items') then 'settings'
    else 'system'
  end;
$$;

-- What a table's row is called in summaries ("Added trusted device").
create function {{schema}}.audit_noun(p_table_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_table_name
    when 'admins' then 'admin'
    when 'admin_sessions' then 'verified sign-in session'
    when 'trusted_devices' then 'trusted device'
    when 'admin_tokens' then 'one-time link'
    when 'settings' then 'settings'
    when 'leads' then 'lead'
    when 'lead_activities' then 'lead note'
    when 'clients' then 'client'
    when 'client_contacts' then 'client contact'
    when 'contracts' then 'contract'
    when 'deployments' then 'deployment'
    when 'subscriptions' then 'subscription'
    when 'client_documents' then 'client document'
    when 'price_list_items' then 'price list item'
    when 'invoices' then 'invoice'
    when 'invoice_lines' then 'invoice line'
    when 'payments' then 'payment'
    when 'receipts' then 'receipt'
    else replace(p_table_name, '_', ' ') || ' record'
  end;
$$;

-- Secrets never reach the log (LOG-05): hashed tokens and anything password-like
-- are dropped from the before and after images.
create function {{schema}}.audit_redact(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_row is null then null
    else p_row - array['token_hash', 'code_hash', 'password', 'secret', 'code', 'token']
  end;
$$;

-- The exact text each row's hash covers. `pnpm admin:verify-log` recomputes the
-- SHA-256 chain from it outside the database.
create function {{schema}}.audit_canonical(e {{schema}}.audit_events)
returns text
language sql
stable
set search_path = ''
as $$
  select jsonb_build_array(
    e.seq,
    to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    e.actor_type,
    e.actor_id,
    e.action,
    e.table_name,
    e.record_id,
    e.area,
    e.summary,
    e.before,
    e.after,
    e.reason,
    e.ip,
    e.user_agent
  )::text;
$$;

-- Fills in context and links each new row to the one before it. One writer at a
-- time: the lock is held until commit, so the sequence and the chain never fork.
-- Server code acting with the service role names the admin in the x-corex-actor
-- request header, and passes the visitor's address and browser in x-corex-ip and
-- x-corex-user-agent.
create function {{schema}}.audit_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_actor text;
  v_prev text;
begin
  perform pg_advisory_xact_lock(hashtext('corex.audit_chain.{{schema}}'));

  if new.actor_id is null and v_claims ->> 'role' = 'service_role' then
    v_actor := v_headers ->> 'x-corex-actor';
    if v_actor ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      new.actor_id := v_actor::uuid;
      if new.actor_type = 'system' then
        new.actor_type := 'admin';
      end if;
    end if;
  end if;
  if new.actor_id is null and new.actor_type = 'admin' then
    new.actor_type := 'system';
  end if;
  new.area := coalesce(new.area, {{schema}}.audit_area(new.table_name));
  new.ip := coalesce(new.ip, left(v_headers ->> 'x-corex-ip', 64));
  new.user_agent := coalesce(new.user_agent, left(v_headers ->> 'x-corex-user-agent', 300));
  new.before := {{schema}}.audit_redact(new.before);
  new.after := {{schema}}.audit_redact(new.after);
  new.summary := coalesce(
    new.summary,
    case new.action
      when 'create' then 'Added '
      when 'update' then 'Changed '
      when 'delete' then 'Deleted '
      when 'void' then 'Voided '
      when 'approve' then 'Approved '
      else initcap(replace(new.action, '_', ' ')) || ' '
    end || {{schema}}.audit_noun(new.table_name)
  );
  new.created_at := now();

  select e.seq, e.row_hash into new.seq, v_prev
  from {{schema}}.audit_events e
  order by e.seq desc
  limit 1;
  new.seq := coalesce(new.seq, 0) + 1;
  new.prev_hash := v_prev;
  new.row_hash := encode(
    sha256(convert_to(coalesce(v_prev, '') || '|' || {{schema}}.audit_canonical(new), 'UTF8')),
    'hex'
  );
  return new;
end;
$$;

revoke execute on function {{schema}}.audit_chain() from public, anon, authenticated;

create trigger audit_chain
  before insert on {{schema}}.audit_events
  for each row execute function {{schema}}.audit_chain();

-- LOG-01: row triggers already refuse UPDATE and DELETE (core 0003); TRUNCATE is
-- refused too, and no API role keeps a privilege that could change a row.
create function {{schema}}.audit_events_no_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end;
$$;

revoke execute on function {{schema}}.audit_events_no_truncate() from public, anon, authenticated;

create trigger audit_events_no_truncate
  before truncate on {{schema}}.audit_events
  for each statement execute function {{schema}}.audit_events_no_truncate();

revoke insert, update, delete, truncate on {{schema}}.audit_events from public, anon, authenticated, service_role;

-- Events that are not row changes (SPEC-ADMIN.md 5.1): sign-ins, emails, downloads,
-- exports, scheduled runs. Called by server code with the service role. Details are
-- checked for secret-looking keys, which are refused rather than stored (LOG-05).
create function {{schema}}.log_event(
  p_area text,
  p_action text,
  p_summary text,
  p_actor_id uuid default null,
  p_actor_type text default 'system',
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default null,
  p_ip text default null,
  p_user_agent text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  if p_details is not null and jsonb_typeof(p_details) <> 'object' then
    raise exception 'Event details must be an object' using errcode = '22023';
  end if;
  if p_details ?| array['password', 'code', 'token', 'secret', 'token_hash', 'code_hash'] then
    raise exception 'Event details must not contain secrets' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_summary, ''))) = 0 then
    raise exception 'An event needs a summary' using errcode = '23514';
  end if;
  insert into {{schema}}.audit_events
    (actor_id, actor_type, action, table_name, record_id, area, summary, after, ip, user_agent)
  values (
    p_actor_id,
    case when p_actor_id is null and p_actor_type = 'admin' then 'system' else p_actor_type end,
    p_action,
    coalesce(p_entity_type, 'event'),
    p_entity_id,
    p_area,
    trim(p_summary),
    p_details,
    left(p_ip, 64),
    left(p_user_agent, 300)
  )
  returning seq into v_seq;
  return v_seq;
end;
$$;

revoke execute on function {{schema}}.log_event(text, text, text, uuid, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function {{schema}}.log_event(text, text, text, uuid, text, text, text, jsonb, text, text)
  to service_role;
