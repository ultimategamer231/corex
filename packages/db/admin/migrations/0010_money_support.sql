-- Money report and support log (audit round, owner-approved A4 and A5).
--
-- Expenses: what Corex itself spends (hosting, domains, software and so on), so the
-- money report shows income, expenses and what is left, per currency, never mixed.
-- Support log: each client's issues, requests and questions with their status, kept as
-- a record (items are closed, never deleted).

-- New tables in the activity log.
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
    when p_table_name in ('clients', 'client_contacts', 'contracts', 'deployments', 'client_documents', 'files',
      'support_tickets')
      then 'clients'
    when p_table_name in ('invoices', 'invoice_lines', 'receipts', 'invoice_links') then 'invoices'
    when p_table_name in ('payments', 'expenses') then 'payments'
    when p_table_name in ('subscriptions', 'renewal_reminders') then 'subscriptions'
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
    when 'expenses' then 'expense'
    when 'support_tickets' then 'support item'
    else replace(p_table_name, '_', ' ') || ' record'
  end;
$$;

create table {{schema}}.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null
    check (category in ('hosting', 'domains', 'software', 'marketing', 'equipment', 'staff', 'other')),
  description text not null check (length(trim(description)) between 2 and 200),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  client_id uuid references {{schema}}.clients (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index expenses_spent_idx on {{schema}}.expenses (spent_on desc);
create trigger expenses_updated_at before update on {{schema}}.expenses
  for each row execute function {{schema}}.set_updated_at();
alter table {{schema}}.expenses enable row level security;
create policy expenses_read on {{schema}}.expenses
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy expenses_add on {{schema}}.expenses
  for insert to authenticated with check ((select {{schema}}.current_admin_ok()));
create policy expenses_change on {{schema}}.expenses
  for update to authenticated using ((select {{schema}}.current_admin_ok()))
  with check ((select {{schema}}.current_admin_ok()));
create policy expenses_remove on {{schema}}.expenses
  for delete to authenticated using ((select {{schema}}.current_admin_ok()));
select {{schema}}.enable_audit('{{schema}}.expenses');

create table {{schema}}.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  opened_on date not null default {{schema}}.today_monrovia(),
  kind text not null default 'issue' check (kind in ('issue', 'request', 'question')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  title text not null check (length(trim(title)) between 3 and 160),
  details text check (details is null or length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_on date,
  resolution text check (resolution is null or length(resolution) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint support_tickets_resolved check ((status = 'resolved') = (resolved_on is not null))
);
create index support_tickets_client_idx on {{schema}}.support_tickets (client_id, opened_on desc);
create index support_tickets_open_idx on {{schema}}.support_tickets (status) where status <> 'resolved';

-- Resolving sets the day (today unless given); reopening clears it.
create function {{schema}}.support_tickets_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' then
    new.resolved_on := coalesce(new.resolved_on, {{schema}}.today_monrovia());
  else
    new.resolved_on := null;
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'A support item stays with its client' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.support_tickets_status() from public, anon, authenticated;

create trigger support_tickets_status before insert or update on {{schema}}.support_tickets
  for each row execute function {{schema}}.support_tickets_status();
create trigger support_tickets_updated_at before update on {{schema}}.support_tickets
  for each row execute function {{schema}}.set_updated_at();
alter table {{schema}}.support_tickets enable row level security;
create policy support_tickets_read on {{schema}}.support_tickets
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy support_tickets_add on {{schema}}.support_tickets
  for insert to authenticated with check ((select {{schema}}.current_admin_ok()));
create policy support_tickets_change on {{schema}}.support_tickets
  for update to authenticated using ((select {{schema}}.current_admin_ok()))
  with check ((select {{schema}}.current_admin_ok()));
revoke delete on {{schema}}.support_tickets from authenticated;
select {{schema}}.enable_audit('{{schema}}.support_tickets');

-- The money report for one year (Monrovia time): per currency, payments received and
-- expenses by month (12 amounts each, minor units as text), payments by product and
-- expenses by category. Currencies are never added together.
create function {{schema}}.money_report(p_year integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with paid as (
    select p.currency, p.amount_minor,
      extract(month from (p.received_at at time zone 'Africa/Monrovia'))::integer as m,
      coalesce(c.product, 'other') as product
    from {{schema}}.payments p
    join {{schema}}.invoices i on i.id = p.invoice_id
    left join {{schema}}.contracts c on c.id = i.contract_id
    where p.status = 'posted'
      and extract(year from (p.received_at at time zone 'Africa/Monrovia'))::integer = p_year
  ),
  spent as (
    select e.currency, e.amount_minor, e.category, extract(month from e.spent_on)::integer as m
    from {{schema}}.expenses e
    where extract(year from e.spent_on)::integer = p_year
  ),
  currencies as (
    select currency from paid union select currency from spent
  )
  select jsonb_build_object(
    'year', p_year,
    'currencies', coalesce((
      select jsonb_object_agg(cur.currency, jsonb_build_object(
        'income', (select jsonb_agg(coalesce((select sum(amount_minor) from paid
                     where currency = cur.currency and m = mm), 0)::text order by mm)
                   from generate_series(1, 12) mm),
        'expenses', (select jsonb_agg(coalesce((select sum(amount_minor) from spent
                       where currency = cur.currency and m = mm), 0)::text order by mm)
                     from generate_series(1, 12) mm),
        'by_product', coalesce((select jsonb_object_agg(product, total::text) from (
            select product, sum(amount_minor) as total from paid
            where currency = cur.currency group by product) x), '{}'::jsonb),
        'by_category', coalesce((select jsonb_object_agg(category, total::text) from (
            select category, sum(amount_minor) as total from spent
            where currency = cur.currency group by category) x), '{}'::jsonb)
      ))
      from currencies cur), '{}'::jsonb)
  );
$$;

revoke execute on function {{schema}}.money_report(integer) from public, anon;
grant execute on function {{schema}}.money_report(integer) to authenticated, service_role;
