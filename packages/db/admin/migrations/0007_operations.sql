-- Dashboard, subscriptions, the daily job, search, notifications, the price list and
-- sample data (SPEC-ADMIN.md 7, 10, 11, 13; PROGRESS.md Admin A5).
--
-- Renewal dates: a subscription's renewal date is when its yearly fee is due. After
-- it, the client is in a 30-day grace period; at 30 days past it the subscription
-- carries the pause flag. Paying the renewal invoice moves the date a year (PAY-06),
-- which clears both. Nothing is ever paused automatically.

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
    when p_table_name in ('clients', 'client_contacts', 'contracts', 'deployments', 'client_documents', 'files')
      then 'clients'
    when p_table_name in ('invoices', 'invoice_lines', 'receipts', 'invoice_links') then 'invoices'
    when p_table_name = 'payments' then 'payments'
    when p_table_name in ('subscriptions', 'renewal_reminders') then 'subscriptions'
    when p_table_name in ('settings', 'price_list_items') then 'settings'
    else 'system'
  end;
$$;

-- Product names as invoices print them (apps/admin/lib/clients.ts CONTRACT_PRODUCTS).
create function {{schema}}.product_label(p_product text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_product
    when 'school_college' then 'School: College'
    when 'school_highschool' then 'School: High School'
    when 'clinic' then 'Clinic Management'
    when 'finance' then 'Financial Management'
    when 'custom' then 'Built on request'
    else coalesce(p_product, '')
  end;
$$;

grant execute on function {{schema}}.product_label(text) to authenticated, service_role;

-- Sample data (SPEC-ADMIN.md 13). Rows written while `corex.sample` is on (pnpm
-- admin:seed) are marked is_sample; the mark can never be set or cleared otherwise.
-- remove_sample_data() (below) deletes only marked rows, so real records are never touched.
create function {{schema}}.sample_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.is_sample := coalesce(current_setting('corex.sample', true), '') = 'on';
  else
    new.is_sample := old.is_sample;
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.sample_flag() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'lead_activities', 'clients', 'client_contacts', 'contracts', 'deployments',
    'subscriptions', 'client_documents', 'invoices', 'invoice_lines', 'payments', 'receipts'
  ] loop
    execute format('alter table {{schema}}.%I add column is_sample boolean not null default false', t);
    execute format(
      'create trigger a_sample_flag before insert or update on {{schema}}.%I for each row execute function {{schema}}.sample_flag()', t);
  end loop;
end;
$$;

-- A rule of the daily job (Settings → Renewals); every rule is on unless switched off.
create function {{schema}}.job_rule_on(p_rule text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.billing_setting('job_' || p_rule, 'true') <> 'false';
$$;

grant execute on function {{schema}}.job_rule_on(text) to authenticated, service_role;

---------------------------------------------------------------------------------------
-- Price list (Settings → Price list). Prefills invoice lines; changing a price never
-- changes an invoice already drafted.
create table {{schema}}.price_list_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null default 'product' check (kind in ('product', 'addon')),
  currency text not null default 'USD' check (currency in ('USD', 'LRD')),
  managed_year1_minor bigint check (managed_year1_minor is null or managed_year1_minor >= 0),
  renewal_minor bigint check (renewal_minor is null or renewal_minor >= 0),
  handover_minor bigint check (handover_minor is null or handover_minor >= 0),
  unit_label text check (unit_label is null or length(unit_label) <= 60),
  active boolean not null default true,
  position integer not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint price_list_items_has_price
    check (coalesce(managed_year1_minor, renewal_minor, handover_minor) is not null)
);
create trigger price_list_items_updated_at before update on {{schema}}.price_list_items
  for each row execute function {{schema}}.set_updated_at();
create trigger a_sample_flag before insert or update on {{schema}}.price_list_items
  for each row execute function {{schema}}.sample_flag();
alter table {{schema}}.price_list_items enable row level security;
create policy price_list_items_read on {{schema}}.price_list_items
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy price_list_items_add on {{schema}}.price_list_items
  for insert to authenticated with check ((select {{schema}}.current_admin_ok()));
create policy price_list_items_change on {{schema}}.price_list_items
  for update to authenticated using ((select {{schema}}.current_admin_ok()))
  with check ((select {{schema}}.current_admin_ok()));
create policy price_list_items_remove on {{schema}}.price_list_items
  for delete to authenticated using ((select {{schema}}.current_admin_ok()));
select {{schema}}.enable_audit('{{schema}}.price_list_items');

---------------------------------------------------------------------------------------
-- Daily job runs (SPEC-ADMIN.md 10): one row per run, also written to the activity log.
create table {{schema}}.job_runs (
  id uuid primary key default gen_random_uuid(),
  run_on date not null,
  trigger text not null default 'schedule' check (trigger in ('schedule', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);
create index job_runs_started_idx on {{schema}}.job_runs (started_at desc);
alter table {{schema}}.job_runs enable row level security;
create policy job_runs_read on {{schema}}.job_runs
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.job_runs from authenticated;

-- Renewal reminders 14 and 3 days before the invoice is due. One row per invoice and
-- stage, so a reminder is never sent twice; "skipped_disabled" while client email is off.
create table {{schema}}.renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references {{schema}}.invoices (id),
  stage text not null check (stage in ('14d', '3d')),
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped_disabled')),
  sent_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, stage)
);
create trigger renewal_reminders_updated_at before update on {{schema}}.renewal_reminders
  for each row execute function {{schema}}.set_updated_at();
alter table {{schema}}.renewal_reminders enable row level security;
create policy renewal_reminders_read on {{schema}}.renewal_reminders
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.renewal_reminders from authenticated;

-- When each admin last opened the notifications (unread count).
create table {{schema}}.admin_notification_state (
  user_id uuid primary key,
  seen_at timestamptz not null default now()
);
alter table {{schema}}.admin_notification_state enable row level security;
create policy admin_notification_state_read on {{schema}}.admin_notification_state
  for select to authenticated
  using (user_id = (select auth.uid()) and (select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.admin_notification_state from authenticated;

create function {{schema}}.mark_notifications_seen()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if not {{schema}}.current_admin_ok() then
    raise exception 'Sign in again' using errcode = '42501';
  end if;
  insert into {{schema}}.admin_notification_state (user_id, seen_at)
  values ((select auth.uid()), v_now)
  on conflict (user_id) do update set seen_at = excluded.seen_at;
  return v_now;
end;
$$;

revoke execute on function {{schema}}.mark_notifications_seen() from public, anon;
grant execute on function {{schema}}.mark_notifications_seen() to authenticated;

---------------------------------------------------------------------------------------
-- Subscriptions with their state for one day (Subscriptions page, dashboard, job).
-- security invoker: row-level security decides what the caller sees.
create function {{schema}}.subscription_overview(p_today date default null)
returns table (
  subscription_id uuid,
  client_id uuid,
  client_name text,
  contract_id uuid,
  product text,
  renewal_amount_minor bigint,
  currency text,
  next_renewal_on date,
  days_to_renewal integer,
  state text,
  pause_flag_on date,
  invoice_id uuid,
  invoice_number text,
  invoice_status text,
  invoice_due_on date,
  reminder_14d text,
  reminder_3d text,
  is_sample boolean
)
language sql
stable
set search_path = ''
as $$
  with today as (select coalesce(p_today, {{schema}}.today_monrovia()) as d)
  select
    s.id, s.client_id, c.name, s.contract_id, k.product, s.renewal_amount_minor, s.currency,
    s.next_renewal_on,
    (s.next_renewal_on - t.d)::integer,
    case
      when s.ended_at is not null then 'ended'
      when s.paused_at is not null then 'paused'
      when s.next_renewal_on is null then 'starts_at_go_live'
      when s.next_renewal_on - t.d > 30 then 'active'
      when s.next_renewal_on >= t.d then 'due_soon'
      when t.d - s.next_renewal_on >= 30 and {{schema}}.job_rule_on('pause_flag') then 'pause_flag'
      else 'grace'
    end,
    case when s.next_renewal_on is not null then s.next_renewal_on + 30 end,
    i.id, i.display_number,
    case
      when i.status in ('issued', 'partially_paid') and i.due_date < t.d then 'overdue'
      else i.status
    end,
    i.due_date,
    (select r.status from {{schema}}.renewal_reminders r where r.invoice_id = i.id and r.stage = '14d'),
    (select r.status from {{schema}}.renewal_reminders r where r.invoice_id = i.id and r.stage = '3d'),
    s.is_sample
  from {{schema}}.subscriptions s
  cross join today t
  join {{schema}}.clients c on c.id = s.client_id
  join {{schema}}.contracts k on k.id = s.contract_id
  left join {{schema}}.invoices i
    on i.kind = 'renewal' and i.contract_id = s.contract_id
    and i.renewal_for = s.next_renewal_on and i.status <> 'void'
  order by (s.ended_at is not null), (s.paused_at is not null), s.next_renewal_on nulls last, c.name;
$$;

grant execute on function {{schema}}.subscription_overview(date) to authenticated, service_role;

---------------------------------------------------------------------------------------
-- "Needs attention" (SPEC-ADMIN.md 7): one row per item, each linking to its record.
-- `since` is when the item started to need attention (notifications unread count).
create function {{schema}}.attention_items(p_today date default null)
returns table (
  kind text,
  record_id uuid,
  title text,
  detail text,
  href text,
  since timestamptz,
  sort_order integer
)
language sql
stable
set search_path = ''
as $$
  with today as (select coalesce(p_today, {{schema}}.today_monrovia()) as d),
  overdue as (
    select i.id, i.kind, i.display_number, i.due_date, i.contract_id, i.renewal_for, c.name,
      i.total_minor - b.paid_minor as balance, i.currency
    from {{schema}}.invoices i
    join {{schema}}.invoice_balances b on b.invoice_id = i.id
    join {{schema}}.clients c on c.id = i.party_id
    cross join today t
    where i.status in ('issued', 'partially_paid') and i.due_date < t.d
  ),
  subs as (select * from {{schema}}.subscription_overview(p_today)),
  new_leads as (
    select count(*)::integer as n, max(l.created_at) as latest,
      string_agg(l.organization, ', ' order by l.created_at desc) as names
    from {{schema}}.leads l where l.stage = 'new'
  )
  -- Overdue invoices; a renewal also names its pause date.
  select 'overdue', o.id,
    case when o.kind = 'renewal'
      then o.name || ': renewal ' || (t.d - o.due_date) || ' days overdue'
      else o.name || ': invoice ' || coalesce(o.display_number, '') || ' ' || (t.d - o.due_date) || ' days overdue'
    end,
    'Invoice ' || coalesce(o.display_number, '') || ' · ' || {{schema}}.money_text(o.balance, o.currency)
      || case when o.kind = 'renewal' and o.renewal_for is not null and {{schema}}.job_rule_on('pause_flag')
           then ' · pause flag on ' || to_char(o.renewal_for + 30, 'FMDD Mon') else '' end,
    '/invoices/' || o.id,
    ((o.due_date + 1)::timestamp at time zone 'Africa/Monrovia'),
    1
  from overdue o cross join today t
  union all
  -- 30 days past the renewal date: an admin exports the data and pauses by hand.
  select 'pause_flag', s.client_id,
    'Pause flag: ' || s.client_name || ' is ' || (-s.days_to_renewal) || ' days past renewal',
    'Export their data, send it to them, then pause the system by hand',
    '/clients/' || s.client_id,
    ((s.pause_flag_on)::timestamp at time zone 'Africa/Monrovia'),
    2
  from subs s where s.state = 'pause_flag'
  union all
  -- Follow-ups due today or tomorrow (and any already missed).
  select 'follow_up', l.id,
    coalesce(nullif(l.next_step, ''), 'Follow up') || ': ' || l.name || ', ' || l.organization,
    case
      when l.follow_up_on < t.d then 'Follow-up was due ' || to_char(l.follow_up_on, 'FMDD Mon')
      when l.follow_up_on = t.d then 'Follow-up due today'
      else 'Follow-up due tomorrow, ' || to_char(l.follow_up_on, 'FMDD Mon')
    end,
    '/leads/' || l.id,
    (((l.follow_up_on - 1))::timestamp at time zone 'Africa/Monrovia'),
    3
  from {{schema}}.leads l cross join today t
  where l.follow_up_on <= t.d + 1 and l.stage in ('new', 'contacted', 'demo_booked', 'quoted')
  union all
  -- New leads nobody has contacted, as one item.
  select 'new_leads', null::uuid,
    case when n.n = 1 then '1 new lead not contacted yet' else n.n || ' new leads not contacted yet' end,
    left(n.names, 120),
    '/leads?stage=new',
    n.latest,
    4
  from new_leads n where n.n > 0
  union all
  -- Renewals within 30 days, and renewals past their date without an overdue invoice.
  select 'renewal', s.client_id,
    case when s.days_to_renewal >= 0
      then s.client_name || ' renews in ' || s.days_to_renewal || ' days'
      else s.client_name || ' renewal was due ' || to_char(s.next_renewal_on, 'FMDD Mon')
    end,
    case
      when s.invoice_id is null then 'No renewal invoice yet · ' || {{schema}}.money_text(s.renewal_amount_minor, s.currency)
      when s.invoice_status = 'draft' then 'Renewal invoice ready to send · ' || {{schema}}.money_text(s.renewal_amount_minor, s.currency)
      when s.invoice_status = 'paid' then 'Renewal invoice paid'
      else 'Renewal invoice sent · ' || {{schema}}.money_text(s.renewal_amount_minor, s.currency)
        || coalesce(' due ' || to_char(s.invoice_due_on, 'FMDD Mon'), '')
    end,
    case when s.invoice_id is not null then '/invoices/' || s.invoice_id else '/subscriptions' end,
    ((s.next_renewal_on - 30)::timestamp at time zone 'Africa/Monrovia'),
    5
  from subs s
  where s.state in ('due_soon', 'grace')
    and not (s.state = 'grace' and s.invoice_status = 'overdue')
  union all
  -- Handover warranties ending within 45 days.
  select 'warranty', d.client_id,
    c.name || ' warranty ends ' || to_char(d.warranty_ends_on, 'FMDD Mon'),
    'Handover plan · offer a paid support plan',
    '/clients/' || d.client_id,
    ((d.warranty_ends_on - 45)::timestamp at time zone 'Africa/Monrovia'),
    6
  from {{schema}}.deployments d
  join {{schema}}.clients c on c.id = d.client_id
  cross join today t
  where d.warranty_ends_on between t.d and t.d + 45
    and d.environment not in ('ended')
    and {{schema}}.job_rule_on('warranty_flag')
  order by 7, 6;
$$;

grant execute on function {{schema}}.attention_items(date) to authenticated, service_role;

---------------------------------------------------------------------------------------
-- Dashboard figures (SPEC-ADMIN.md 7). Money is always per currency, never summed
-- across USD and LRD. Amounts are minor units as text (bigint-safe in JSON).
create function {{schema}}.dashboard_figures(p_today date default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (
    select coalesce(p_today, {{schema}}.today_monrovia()) as d,
      extract(year from coalesce(p_today, {{schema}}.today_monrovia()))::integer as y
  ),
  open_invoices as (
    select i.currency, i.due_date, i.total_minor - b.paid_minor as balance
    from {{schema}}.invoices i
    join {{schema}}.invoice_balances b on b.invoice_id = i.id
    where i.status in ('issued', 'partially_paid')
  ),
  paid as (
    select p.currency, extract(month from (p.received_at at time zone 'Africa/Monrovia'))::integer as m,
      p.amount_minor
    from {{schema}}.payments p cross join today t
    where p.status = 'posted'
      and extract(year from (p.received_at at time zone 'Africa/Monrovia'))::integer = t.y
  )
  select jsonb_build_object(
    'today', (select d from today),
    'new_leads', (
      select jsonb_build_object(
        'count', count(*),
        'not_contacted', count(*) filter (where l.stage = 'new'))
      from {{schema}}.leads l cross join today t
      where (l.created_at at time zone 'Africa/Monrovia')::date > t.d - 7
    ),
    'pipeline', jsonb_build_object(
      'open', (select count(*) from {{schema}}.leads
               where stage in ('new', 'contacted', 'demo_booked', 'quoted')),
      'quoted', (select count(*) from {{schema}}.leads
                 where stage = 'quoted' and quote_amount_minor is not null and quote_sent_on is not null),
      'quoted_by_currency', coalesce((
        select jsonb_object_agg(quote_currency, total::text)
        from (select quote_currency, sum(quote_amount_minor) as total from {{schema}}.leads
              where stage = 'quoted' and quote_amount_minor is not null and quote_sent_on is not null
              group by quote_currency) q), '{}'::jsonb),
      'stages', (
        select jsonb_object_agg(st, (select count(*) from {{schema}}.leads l where l.stage = st))
        from unnest(array['new', 'contacted', 'demo_booked', 'quoted', 'won', 'lost']) st
      ),
      'won_this_year', (select count(*) from {{schema}}.leads l cross join today t
        where l.stage = 'won' and extract(year from (l.stage_changed_at at time zone 'Africa/Monrovia'))::integer = t.y),
      'lost_this_year', (select count(*) from {{schema}}.leads l cross join today t
        where l.stage = 'lost' and extract(year from (l.stage_changed_at at time zone 'Africa/Monrovia'))::integer = t.y)
    ),
    'outstanding', jsonb_build_object(
      'by_currency', coalesce((
        select jsonb_object_agg(currency, total::text)
        from (select currency, sum(balance) as total from open_invoices group by currency) o), '{}'::jsonb),
      'overdue', (select count(*) from open_invoices o cross join today t where o.due_date < t.d)
    ),
    'collected', jsonb_build_object(
      'year', (select y from today),
      'by_currency', coalesce((
        select jsonb_object_agg(currency, total::text)
        from (select currency, sum(amount_minor) as total from paid group by currency) p), '{}'::jsonb),
      'by_month', coalesce((
        select jsonb_object_agg(currency, months)
        from (
          select c.currency, jsonb_agg(coalesce(
              (select sum(p.amount_minor) from paid p where p.currency = c.currency and p.m = mm), 0
            )::text order by mm) as months
          from (select distinct currency from paid) c
          cross join generate_series(1, 12) mm
          group by c.currency
        ) x), '{}'::jsonb)
    )
  );
$$;

grant execute on function {{schema}}.dashboard_figures(date) to authenticated, service_role;

---------------------------------------------------------------------------------------
-- Global search (SPEC-ADMIN.md 11): leads by name, organization, phone or email;
-- clients by name; invoices and receipts by number. Up to 5 results per type.
create function {{schema}}.admin_search(p_query text)
returns table (kind text, id uuid, title text, detail text, href text)
language sql
stable
set search_path = ''
as $$
  with q as (
    select
      '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      {{schema}}.lead_phone_key(p_query) as phone
    where length(trim(coalesce(p_query, ''))) >= 2
  )
  (select 'lead', l.id, l.name || ', ' || l.organization,
     {{schema}}.lead_stage_label(l.stage) || coalesce(' · ' || coalesce(l.email, l.phone), ''),
     '/leads/' || l.id
   from {{schema}}.leads l cross join q
   where l.name ilike q.pattern or l.organization ilike q.pattern or l.email ilike q.pattern
     or (length(q.phone) >= 6 and {{schema}}.lead_phone_key(l.phone) like '%' || q.phone || '%')
   order by l.created_at desc limit 5)
  union all
  (select 'client', c.id, c.name, concat_ws(', ', c.city, c.country), '/clients/' || c.id
   from {{schema}}.clients c cross join q
   where c.name ilike q.pattern
   order by c.name limit 5)
  union all
  (select 'invoice', i.id, i.display_number, c.name || ' · ' || {{schema}}.money_text(i.total_minor, i.currency),
     '/invoices/' || i.id
   from {{schema}}.invoices i join {{schema}}.clients c on c.id = i.party_id cross join q
   where i.display_number ilike q.pattern
   order by i.display_number desc limit 5)
  union all
  (select 'receipt', r.id, r.display_number,
     c.name || ' · ' || {{schema}}.money_text(p.amount_minor, p.currency),
     '/invoices/' || p.invoice_id
   from {{schema}}.receipts r
   join {{schema}}.payments p on p.id = r.payment_id
   join {{schema}}.invoices i on i.id = p.invoice_id
   join {{schema}}.clients c on c.id = i.party_id
   cross join q
   where r.display_number ilike q.pattern
   order by r.display_number desc limit 5);
$$;

grant execute on function {{schema}}.admin_search(text) to authenticated;

---------------------------------------------------------------------------------------
-- The daily job (SPEC-ADMIN.md 10), called by /api/cron/daily with the service role.
-- Idempotent: a renewal invoice is created once per period (unique index) and a
-- reminder once per invoice and stage (unique key), so a second run the same day
-- changes nothing; it is still recorded in job_runs and the activity log.
-- With client email on (p_email) a new renewal invoice is sent at once and reminders
-- are queued for the app to email; otherwise the invoice stays a draft for an admin to
-- send (owner decision 2026-10-31) and reminders are recorded as not sent.
create function {{schema}}.daily_job(p_email boolean default false, p_trigger text default 'schedule')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := {{schema}}.today_monrovia();
  v_run uuid;
  v_sub record;
  v_inv record;
  v_id uuid;
  v_rid uuid;
  v_renewals jsonb := '[]'::jsonb;
  v_reminders jsonb := '[]'::jsonb;
  v_grace integer;
  v_pause integer := 0;
  v_warranty integer := 0;
  v_summary jsonb;
  v_parts text[] := '{}';
begin
  if (select auth.uid()) is not null then
    raise exception 'Only the scheduled job runs this' using errcode = '42501';
  end if;
  if p_trigger not in ('schedule', 'manual') then
    raise exception 'Unknown trigger' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('{{schema}}.daily_job'));
  insert into {{schema}}.job_runs (run_on, trigger) values (v_today, p_trigger) returning id into v_run;

  -- Renewal invoices, 30 days before the renewal date.
  if {{schema}}.job_rule_on('renewal_invoice') then
    for v_sub in
      select s.client_id, s.contract_id, s.renewal_amount_minor, s.currency, s.next_renewal_on, k.product
      from {{schema}}.subscriptions s
      join {{schema}}.contracts k on k.id = s.contract_id
      where s.paused_at is null and s.ended_at is null and s.next_renewal_on is not null
        and s.next_renewal_on <= v_today + 30
        and not exists (
          select 1 from {{schema}}.invoices i
          where i.kind = 'renewal' and i.contract_id = s.contract_id
            and i.renewal_for = s.next_renewal_on and i.status <> 'void'
        )
      order by s.next_renewal_on
    loop
      v_id := {{schema}}.save_invoice_draft(null, jsonb_build_object(
        'client_id', v_sub.client_id,
        'kind', 'renewal',
        'contract_id', v_sub.contract_id,
        'renewal_for', v_sub.next_renewal_on,
        'currency', v_sub.currency,
        -- Due on the renewal date, and never sooner than a week after it is drafted.
        'payment_terms_days', greatest(v_sub.next_renewal_on - v_today, 7),
        'lines', jsonb_build_array(jsonb_build_object(
          'description', 'Yearly renewal',
          'details', {{schema}}.product_label(v_sub.product) || ', '
            || to_char(v_sub.next_renewal_on, 'FMDD Mon YYYY') || ' to '
            || to_char((v_sub.next_renewal_on + interval '1 year' - interval '1 day')::date, 'FMDD Mon YYYY'),
          'quantity', 1,
          'unit_amount_minor', v_sub.renewal_amount_minor
        ))
      ));
      if p_email then
        perform {{schema}}.issue_invoice(v_id);
      end if;
      v_renewals := v_renewals || jsonb_build_object('invoice_id', v_id, 'sent', p_email);
    end loop;
  end if;

  -- Reminders 14 and 3 days before the renewal invoice is due, while unpaid.
  if {{schema}}.job_rule_on('reminders') then
    for v_inv in
      select i.id, case when i.due_date - v_today <= 3 then '3d' else '14d' end as stage
      from {{schema}}.invoices i
      where i.kind = 'renewal' and i.status in ('issued', 'partially_paid')
        and i.due_date is not null and i.due_date - v_today between 0 and 14
    loop
      v_rid := null;
      insert into {{schema}}.renewal_reminders (invoice_id, stage, status)
      values (v_inv.id, v_inv.stage, case when p_email then 'queued' else 'skipped_disabled' end)
      on conflict (invoice_id, stage) do nothing
      returning id into v_rid;
      if v_rid is not null then
        v_reminders := v_reminders || jsonb_build_object(
          'reminder_id', v_rid, 'invoice_id', v_inv.id, 'stage', v_inv.stage, 'queued', p_email);
      end if;
    end loop;
  end if;

  -- Grace, pause flags and warranties are worked out from dates; the run counts them.
  select count(*) filter (where state = 'grace'), count(*) filter (where state = 'pause_flag')
  into v_grace, v_pause
  from {{schema}}.subscription_overview(v_today);
  if {{schema}}.job_rule_on('warranty_flag') then
    select count(*) into v_warranty from {{schema}}.deployments
    where warranty_ends_on between v_today and v_today + 45 and environment <> 'ended';
  end if;

  v_summary := jsonb_build_object(
    'renewal_invoices', jsonb_array_length(v_renewals),
    'renewal_invoices_sent', p_email,
    'reminders', jsonb_array_length(v_reminders),
    'grace', v_grace,
    'pause_flags', v_pause,
    'warranties', v_warranty
  );
  if jsonb_array_length(v_renewals) > 0 then
    v_parts := v_parts || (jsonb_array_length(v_renewals) || ' renewal invoice'
      || case when jsonb_array_length(v_renewals) = 1 then '' else 's' end
      || case when p_email then ' sent' else ' drafted' end);
  end if;
  if jsonb_array_length(v_reminders) > 0 then
    v_parts := v_parts || (jsonb_array_length(v_reminders) || ' reminder'
      || case when jsonb_array_length(v_reminders) = 1 then '' else 's' end
      || case when p_email then ' queued' else ' due (email is off)' end);
  end if;
  if v_grace > 0 then v_parts := v_parts || (v_grace || ' in grace period'); end if;
  if v_pause > 0 then
    v_parts := v_parts || (v_pause || ' pause flag' || case when v_pause = 1 then '' else 's' end);
  end if;
  if v_warranty > 0 then
    v_parts := v_parts || (v_warranty || ' warrant' || case when v_warranty = 1 then 'y' else 'ies' end
      || ' ending soon');
  end if;

  update {{schema}}.job_runs set finished_at = now(), summary = v_summary where id = v_run;
  perform {{schema}}.log_event(
    'system', 'daily_job',
    'Daily job ran: ' || coalesce(nullif(array_to_string(v_parts, ', '), ''), 'nothing to do'),
    null, 'system', 'job_runs', v_run::text, v_summary
  );
  return jsonb_build_object(
    'run_id', v_run, 'renewals', v_renewals, 'reminders', v_reminders, 'summary', v_summary);
end;
$$;

revoke execute on function {{schema}}.daily_job(boolean, text) from public, anon, authenticated;
grant execute on function {{schema}}.daily_job(boolean, text) to service_role;

---------------------------------------------------------------------------------------
-- Removing sample data. True only inside remove_sample_data(), for a sample row.
create function {{schema}}.unseeding(p_is_sample boolean)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_is_sample, false) and coalesce(current_setting('corex.unseed', true), '') = 'on';
$$;

-- Guards run as the caller, so the app roles may call it; it only reads a setting.
revoke execute on function {{schema}}.unseeding(boolean) from public, anon;
grant execute on function {{schema}}.unseeding(boolean) to authenticated, service_role;

-- The guards that keep money and history permanent let only sample rows go.
create or replace function {{schema}}.never_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if {{schema}}.unseeding(old.is_sample) then
    return old;
  end if;
  raise exception '% rows are never deleted; void them instead', tg_table_name using errcode = '23514';
end;
$$;

create or replace function {{schema}}.invoice_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' and {{schema}}.unseeding(old.is_sample) then
    return old;
  end if;
  select status into v_status
  from {{schema}}.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is distinct from 'draft' then
    raise exception 'Invoice lines can only change while the invoice is a draft' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.amount_minor := round(new.quantity * new.unit_amount_minor)::bigint;
  return new;
end;
$$;

create or replace function {{schema}}.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if (old.status = 'draft' and old.number is null) or {{schema}}.unseeding(old.is_sample) then
      return old;
    end if;
    raise exception 'Sent invoices are never deleted; void them instead' using errcode = '23514';
  end if;
  if old.status <> 'draft'
    and (new.number is distinct from old.number
      or new.display_number is distinct from old.display_number
      or new.party_type is distinct from old.party_type
      or new.party_id is distinct from old.party_id
      or new.currency is distinct from old.currency
      or new.total_minor is distinct from old.total_minor) then
    raise exception 'A sent invoice cannot change its number, client, currency or total' using errcode = '23514';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'A void invoice cannot be reopened' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function {{schema}}.leads_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if {{schema}}.unseeding(old.is_sample) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Leads are never deleted; mark them Lost instead' using errcode = '23514';
  end if;
  if new.source is distinct from old.source or new.created_at is distinct from old.created_at then
    raise exception 'Where and when a lead arrived cannot change' using errcode = '23514';
  end if;
  if old.source = 'website' and (
    new.name, new.organization, new.country, new.product, new.plan_interest, new.phone,
    new.email, new.message, new.consent, new.source_page
  ) is distinct from (
    old.name, old.organization, old.country, old.product, old.plan_interest, old.phone,
    old.email, old.message, old.consent, old.source_page
  ) then
    raise exception 'The original website request cannot be changed; add a note instead'
      using errcode = '23514';
  end if;
  if old.converted_client_id is not null and new.converted_client_id is distinct from old.converted_client_id then
    raise exception 'This lead was already converted' using errcode = '23514';
  end if;
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage <> 'lost' then
      new.lost_reason := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function {{schema}}.lead_activities_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and {{schema}}.unseeding(old.is_sample) then
    return old;
  end if;
  if tg_op <> 'INSERT' then
    raise exception 'Notes and activities cannot be changed or removed; add a new one'
      using errcode = '42501';
  end if;
  if (select auth.uid()) is not null then
    new.admin_id := {{schema}}.current_admin_id();
  end if;
  new.created_at := now();
  return new;
end;
$$;

create function {{schema}}.has_sample_data()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from {{schema}}.clients where is_sample)
    or exists (select 1 from {{schema}}.leads where is_sample)
    or exists (select 1 from {{schema}}.invoices where is_sample)
    or exists (select 1 from {{schema}}.price_list_items where is_sample);
$$;

grant execute on function {{schema}}.has_sample_data() to authenticated, service_role;

-- pnpm admin:unseed. Fails as a whole (nothing removed) if a real record uses a sample
-- one, for example an invoice made for a sample client.
create function {{schema}}.remove_sample_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- Invoices name their client without a foreign key, so check every link by hand.
  if exists (
    select 1 from {{schema}}.invoices i
    where not i.is_sample and (
      i.party_id in (select id from {{schema}}.clients where is_sample)
      or i.contract_id in (select id from {{schema}}.contracts where is_sample))
  ) or exists (
    select 1 from {{schema}}.payments p
    where not p.is_sample and p.invoice_id in (select id from {{schema}}.invoices where is_sample)
  ) or exists (
    select 1 from {{schema}}.invoice_lines l
    where not l.is_sample and l.invoice_id in (select id from {{schema}}.invoices where is_sample)
  ) or exists (
    select 1 from {{schema}}.client_contacts x
    where not x.is_sample and x.client_id in (select id from {{schema}}.clients where is_sample)
  ) or exists (
    select 1 from {{schema}}.client_documents x
    where not x.is_sample and x.client_id in (select id from {{schema}}.clients where is_sample)
  ) or exists (
    select 1 from {{schema}}.contracts x
    where not x.is_sample and x.client_id in (select id from {{schema}}.clients where is_sample)
  ) or exists (
    select 1 from {{schema}}.deployments x
    where not x.is_sample and x.client_id in (select id from {{schema}}.clients where is_sample)
  ) or exists (
    select 1 from {{schema}}.lead_activities x
    where not x.is_sample and x.lead_id in (select id from {{schema}}.leads where is_sample)
  ) then
    raise exception 'Some records of your own use sample data (for example an invoice or note for a sample client). Remove or void them first.'
      using errcode = '23503';
  end if;
  perform set_config('corex.unseed', 'on', true);
  update {{schema}}.leads set converted_client_id = null where is_sample and converted_client_id is not null;
  delete from {{schema}}.renewal_reminders
    where invoice_id in (select id from {{schema}}.invoices where is_sample);
  delete from {{schema}}.invoice_link_opens
    where invoice_id in (select id from {{schema}}.invoices where is_sample);
  delete from {{schema}}.invoice_links
    where invoice_id in (select id from {{schema}}.invoices where is_sample);
  delete from {{schema}}.receipts where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('receipts', v_n);
  delete from {{schema}}.payments where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('payments', v_n);
  delete from {{schema}}.invoice_lines where is_sample;
  delete from {{schema}}.invoices where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('invoices', v_n);
  delete from {{schema}}.subscriptions where is_sample;
  delete from {{schema}}.deployments where is_sample;
  delete from {{schema}}.contracts where is_sample;
  delete from {{schema}}.client_documents where is_sample;
  delete from {{schema}}.client_contacts where is_sample;
  delete from {{schema}}.clients where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('clients', v_n);
  delete from {{schema}}.lead_activities where is_sample;
  delete from {{schema}}.leads where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('leads', v_n);
  delete from {{schema}}.price_list_items where is_sample;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('price_list_items', v_n);
  perform set_config('corex.unseed', '', true);
  perform {{schema}}.log_event('system', 'sample_data_removed', 'Sample data removed', null, 'system',
    null, null, v_counts);
  return v_counts;
end;
$$;

revoke execute on function {{schema}}.remove_sample_data() from public, anon, authenticated, service_role;
