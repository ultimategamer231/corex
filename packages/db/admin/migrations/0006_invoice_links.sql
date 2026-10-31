-- Client view links (SPEC-ADMIN.md 9.5, LINK-01 to LINK-04). Each sent invoice can have
-- one link /i/<token>: 32 random bytes, only their SHA-256 kept here, valid 30 days.
-- A new link replaces the old one. The token hash lives in its own table so the
-- activity log drops it (audit_redact removes token_hash).

-- Client view links appear under Invoices in the activity log.
create or replace function {{schema}}.audit_area(p_table_name text)
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
    when p_table_name in ('invoices', 'invoice_lines', 'receipts', 'invoice_links') then 'invoices'
    when p_table_name = 'payments' then 'payments'
    when p_table_name = 'subscriptions' then 'subscriptions'
    when p_table_name in ('settings', 'price_list_items') then 'settings'
    else 'system'
  end;
$$;

create or replace function {{schema}}.audit_noun(p_table_name text)
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
    when 'invoice_links' then 'client view link'
    else replace(p_table_name, '_', ' ') || ' record'
  end;
$$;

create table {{schema}}.invoice_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references {{schema}}.invoices (id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- The first open of each day is logged (LINK-04).
create table {{schema}}.invoice_link_opens (
  invoice_id uuid not null references {{schema}}.invoices (id),
  opened_on date not null,
  primary key (invoice_id, opened_on)
);

alter table {{schema}}.invoice_links enable row level security;
alter table {{schema}}.invoice_link_opens enable row level security;
create policy invoice_links_read on {{schema}}.invoice_links
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.invoice_links from authenticated;
revoke all on {{schema}}.invoice_link_opens from authenticated;
select {{schema}}.enable_audit('{{schema}}.invoice_links');

-- LINK-01: a new link for a sent invoice, 30 days from now; any older one stops working.
create function {{schema}}.create_invoice_link(p_invoice_id uuid, p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_expires timestamptz := now() + interval '30 days';
begin
  perform {{schema}}.require_billing_role();
  select status into v_status from {{schema}}.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_status not in ('issued', 'partially_paid', 'paid') then
    raise exception 'Only a sent invoice has a client view link' using errcode = '23514';
  end if;
  insert into {{schema}}.invoice_links (invoice_id, token_hash, expires_at)
  values (p_invoice_id, p_token_hash, v_expires)
  on conflict (invoice_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at, updated_at = now();
  return v_expires;
end;
$$;

revoke execute on function {{schema}}.create_invoice_link(uuid, text) from public, anon;
grant execute on function {{schema}}.create_invoice_link(uuid, text) to authenticated, service_role;

-- LINK-02, LINK-03: the invoice a link shows, or null when it is unknown, expired,
-- replaced or the invoice is void. Called by the public page with the service role.
create function {{schema}}.open_invoice_link(p_token_hash text, p_ip text default null, p_user_agent text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice uuid;
  v_number text;
  v_logged integer;
begin
  select l.invoice_id, i.display_number into v_invoice, v_number
  from {{schema}}.invoice_links l
  join {{schema}}.invoices i on i.id = l.invoice_id
  where l.token_hash = p_token_hash and l.expires_at > now() and i.status <> 'void';
  if v_invoice is null then
    return null;
  end if;
  insert into {{schema}}.invoice_link_opens (invoice_id, opened_on)
  values (v_invoice, {{schema}}.today_monrovia())
  on conflict do nothing;
  get diagnostics v_logged = row_count;
  if v_logged > 0 then
    perform {{schema}}.log_event(
      'invoices', 'client_link_opened',
      'The client opened invoice ' || coalesce(v_number, '') || ' through the client view link',
      null, 'client_link', 'invoices', v_invoice::text, null, p_ip, p_user_agent
    );
  end if;
  return v_invoice;
end;
$$;

revoke execute on function {{schema}}.open_invoice_link(text, text, text) from public, anon, authenticated;
grant execute on function {{schema}}.open_invoice_link(text, text, text) to service_role;
