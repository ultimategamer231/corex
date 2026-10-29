-- Clients (SPEC-ADMIN.md 4, 8.2; PROGRESS.md Admin A3): organizations with a signed
-- contract, the people to talk to, their contract and payment milestones, the
-- system deployed for them, the yearly subscription (Managed plan) and their
-- documents. A lead becomes a client in one transaction (LEAD-06).

create table {{schema}}.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 150),
  country text check (country is null or length(trim(country)) between 2 and 60),
  city text check (city is null or length(trim(city)) <= 80),
  address text check (address is null or length(address) <= 300),
  source_lead_id uuid unique references {{schema}}.leads (id),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index clients_name_idx on {{schema}}.clients (lower(name));

alter table {{schema}}.leads
  add constraint leads_converted_client_fk
  foreign key (converted_client_id) references {{schema}}.clients (id);

create table {{schema}}.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 100),
  title text check (title is null or length(title) <= 100),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or length(phone) between 7 and 25),
  is_primary boolean not null default false,
  is_billing boolean not null default false,
  phone_key text generated always as ({{schema}}.lead_phone_key(phone)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint client_contacts_reach_check check (phone is not null or email is not null)
);
create index client_contacts_client_idx on {{schema}}.client_contacts (client_id);
create unique index client_contacts_one_primary on {{schema}}.client_contacts (client_id) where is_primary;
create unique index client_contacts_one_billing on {{schema}}.client_contacts (client_id) where is_billing;
create index client_contacts_phone_key_idx on {{schema}}.client_contacts (phone_key) where phone_key is not null;
create index client_contacts_email_idx on {{schema}}.client_contacts (lower(email)) where email is not null;

-- Payment milestones as whole percentages that add up to 100, for example {50,30,20}.
create function {{schema}}.valid_milestone_scheme(p_scheme integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_scheme, 1) between 1 and 6, false)
    and (select bool_and(p > 0) and sum(p) = 100 from unnest(p_scheme) p);
$$;

-- Each milestone's amount in minor units: its share rounded half up, and the last
-- one takes the remainder so the milestones always add up to the total (SPEC-ADMIN 9.1).
-- The same rule is in apps/admin/lib/contracts.ts; tests check they agree.
create function {{schema}}.milestone_amounts(p_total_minor bigint, p_scheme integer[])
returns table (milestone_no integer, percent integer, amount_minor bigint)
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select s.no::integer as no, s.p as percent,
      (p_total_minor * s.p + 50) / 100 as share,
      count(*) over () as n
    from unnest(p_scheme) with ordinality as s(p, no)
  )
  select no, percent,
    case when no = n
      then p_total_minor - coalesce(sum(share) over (order by no rows between unbounded preceding and 1 preceding), 0)::bigint
      else share
    end
  from parts
  order by no;
$$;

grant execute on function {{schema}}.valid_milestone_scheme(integer[]) to authenticated, service_role;
grant execute on function {{schema}}.milestone_amounts(bigint, integer[]) to authenticated, service_role;

-- Contract numbers CT-YY-MM-NNN (owner decision 2026-10-29): year and month of
-- signing, then a number that restarts each year. Assigned once, never reused.
create table {{schema}}.contract_sequences (
  year integer primary key check (year between 2000 and 2999),
  last_number integer not null default 0 check (last_number >= 0)
);
alter table {{schema}}.contract_sequences enable row level security;
revoke all on {{schema}}.contract_sequences from authenticated;

create table {{schema}}.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  number text not null unique,
  product text not null
    check (product in ('school_college', 'school_highschool', 'clinic', 'finance', 'custom')),
  plan text not null check (plan in ('managed', 'handover')),
  total_minor bigint not null check (total_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  signed_on date not null,
  milestone_scheme integer[] not null default '{50,30,20}'
    check ({{schema}}.valid_milestone_scheme(milestone_scheme)),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index contracts_client_idx on {{schema}}.contracts (client_id, signed_on desc);

create function {{schema}}.contracts_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from new.signed_on)::integer;
  v_next integer;
begin
  if tg_op = 'INSERT' then
    insert into {{schema}}.contract_sequences (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = {{schema}}.contract_sequences.last_number + 1
    returning last_number into v_next;
    new.number := 'CT-' || to_char(new.signed_on, 'YY-MM') || '-'
      || case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;
  elsif new.number is distinct from old.number or new.client_id is distinct from old.client_id then
    raise exception 'A contract''s number and client cannot change' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function {{schema}}.contracts_number() from public, anon, authenticated;

create trigger contracts_number
  before insert or update on {{schema}}.contracts
  for each row execute function {{schema}}.contracts_number();

-- What runs where for a client. The admin keeps deployment details only; the
-- client's own data stays in their database (ClientDetail.dc.html).
create table {{schema}}.deployments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  contract_id uuid references {{schema}}.contracts (id),
  product_version text not null default 'v1.0' check (length(product_version) between 1 and 30),
  environment text not null default 'setup'
    check (environment in ('setup', 'staging', 'live', 'paused', 'ended')),
  app_url text check (app_url is null or length(app_url) <= 200),
  supabase_project_ref text check (supabase_project_ref is null or length(supabase_project_ref) <= 100),
  schema_name text check (schema_name is null or schema_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  hosting text check (hosting is null or length(hosting) <= 100),
  target_go_live date,
  went_live_on date,
  warranty_ends_on date,
  hosting_cost_minor_per_month bigint check (hosting_cost_minor_per_month is null or hosting_cost_minor_per_month >= 0),
  hosting_cost_currency text check (hosting_cost_currency in ('USD', 'LRD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint deployments_hosting_cost_pair
    check ((hosting_cost_minor_per_month is null) = (hosting_cost_currency is null)),
  constraint deployments_warranty_after_live
    check (warranty_ends_on is null or went_live_on is null or warranty_ends_on >= went_live_on)
);
create index deployments_client_idx on {{schema}}.deployments (client_id, created_at desc);

-- Yearly renewal for Managed clients. The first renewal is one year after go-live.
create table {{schema}}.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  contract_id uuid not null unique references {{schema}}.contracts (id),
  renewal_amount_minor bigint not null check (renewal_amount_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  starts_on date,
  next_renewal_on date,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint subscriptions_renewal_after_start
    check (next_renewal_on is null or starts_on is null or next_renewal_on > starts_on)
);
create index subscriptions_client_idx on {{schema}}.subscriptions (client_id);
create index subscriptions_renewal_idx on {{schema}}.subscriptions (next_renewal_on)
  where next_renewal_on is not null and ended_at is null;

-- Going live sets the go-live date; Handover starts a 60-day warranty (D70) and
-- Managed starts the subscription, first renewal one year later.
create function {{schema}}.deployments_go_live()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan text;
begin
  if new.environment = 'live' and new.went_live_on is null then
    new.went_live_on := current_date;
  end if;
  if new.went_live_on is not null and new.warranty_ends_on is null then
    select c.plan into v_plan from {{schema}}.contracts c where c.id = new.contract_id;
    if v_plan = 'handover' then
      new.warranty_ends_on := new.went_live_on + 60;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'A deployment''s client cannot change' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function {{schema}}.deployments_go_live() from public, anon, authenticated;

create trigger deployments_go_live
  before insert or update on {{schema}}.deployments
  for each row execute function {{schema}}.deployments_go_live();

create function {{schema}}.deployments_start_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update {{schema}}.subscriptions
  set starts_on = new.went_live_on,
      next_renewal_on = (new.went_live_on + interval '1 year')::date
  where contract_id = new.contract_id and starts_on is null;
  return new;
end;
$$;

revoke execute on function {{schema}}.deployments_start_subscription() from public, anon, authenticated;

-- Not "update of went_live_on": the go-live trigger above may set it.
create trigger deployments_start_subscription
  after insert or update on {{schema}}.deployments
  for each row
  when (new.went_live_on is not null and new.contract_id is not null)
  execute function {{schema}}.deployments_start_subscription();

-- Contracts, proposals and forms, in the private storage bucket named after the
-- schema. Files go straight from the browser to storage through a one-time upload
-- link; uploaded_at is set once the server has checked the stored file.
create table {{schema}}.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references {{schema}}.clients (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index client_documents_client_idx on {{schema}}.client_documents (client_id, created_at desc);

-- The bucket refuses anything but PDF, JPG and PNG up to 10 MB, whoever uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('{{schema}}', '{{schema}}', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create trigger clients_updated_at before update on {{schema}}.clients
  for each row execute function {{schema}}.set_updated_at();
create trigger client_contacts_updated_at before update on {{schema}}.client_contacts
  for each row execute function {{schema}}.set_updated_at();
create trigger subscriptions_updated_at before update on {{schema}}.subscriptions
  for each row execute function {{schema}}.set_updated_at();
create trigger client_documents_updated_at before update on {{schema}}.client_documents
  for each row execute function {{schema}}.set_updated_at();

-- LEAD-06: a client with its primary contact, contract, deployment (setup) and,
-- for the Managed plan, its subscription, in one transaction. With a lead, the lead
-- becomes Won and points at the client; a lead converts only once. Runs with the
-- caller's access, so row-level security applies to every row.
create function {{schema}}.create_client(p_lead_id uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_lead {{schema}}.leads%rowtype;
  v_client uuid;
  v_contract uuid;
  v_plan text := p ->> 'plan';
  v_currency text := p ->> 'currency';
begin
  if p_lead_id is not null then
    select * into v_lead from {{schema}}.leads where id = p_lead_id for update;
    if not found then
      raise exception 'This lead was not found' using errcode = 'P0002';
    end if;
    if v_lead.converted_client_id is not null then
      raise exception 'This lead was already converted' using errcode = '23514';
    end if;
  end if;

  insert into {{schema}}.clients (name, country, city, address, source_lead_id)
  values (p ->> 'name', p ->> 'country', p ->> 'city', p ->> 'address', p_lead_id)
  returning id into v_client;

  insert into {{schema}}.client_contacts (client_id, name, title, email, phone, is_primary, is_billing)
  values (
    v_client, p ->> 'contact_name', p ->> 'contact_title', p ->> 'contact_email',
    p ->> 'contact_phone', true, true
  );

  insert into {{schema}}.contracts (client_id, product, plan, total_minor, currency, signed_on, milestone_scheme)
  values (
    v_client, p ->> 'product', v_plan, (p ->> 'total_minor')::bigint, v_currency,
    (p ->> 'signed_on')::date,
    coalesce(
      (select array_agg(x::integer order by o) from jsonb_array_elements_text(p -> 'milestone_scheme') with ordinality as s(x, o)),
      '{50,30,20}'
    )
  )
  returning id into v_contract;

  insert into {{schema}}.deployments (client_id, contract_id, target_go_live, hosting_cost_minor_per_month, hosting_cost_currency)
  values (
    v_client, v_contract, (p ->> 'target_go_live')::date,
    (p ->> 'hosting_cost_minor')::bigint,
    case when p ->> 'hosting_cost_minor' is not null then coalesce(p ->> 'hosting_cost_currency', 'USD') end
  );

  if v_plan = 'managed' then
    if p ->> 'renewal_minor' is null then
      raise exception 'A Managed plan needs a yearly renewal amount' using errcode = '23514';
    end if;
    insert into {{schema}}.subscriptions (client_id, contract_id, renewal_amount_minor, currency)
    values (v_client, v_contract, (p ->> 'renewal_minor')::bigint, v_currency);
  end if;

  if p_lead_id is not null then
    update {{schema}}.leads set converted_client_id = v_client, stage = 'won' where id = p_lead_id;
  end if;
  return v_client;
end;
$$;

revoke execute on function {{schema}}.create_client(uuid, jsonb) from public, anon;
grant execute on function {{schema}}.create_client(uuid, jsonb) to authenticated, service_role;

-- LEAD-03 now also checks client contacts. Their rows carry the client's id and
-- name, with stage 'client'.
create or replace function {{schema}}.lead_duplicates(p_phone text, p_email text, p_exclude uuid default null)
returns table (id uuid, name text, organization text, stage text, matched_on text)
language sql
stable
set search_path = ''
as $$
  (
    select l.id, l.name, l.organization, l.stage,
      case when l.phone_key = {{schema}}.lead_phone_key(p_phone) then 'phone' else 'email' end
    from {{schema}}.leads l
    where l.id is distinct from p_exclude
      and (
        l.phone_key = {{schema}}.lead_phone_key(p_phone)
        or (nullif(trim(p_email), '') is not null and lower(l.email) = lower(trim(p_email)))
      )
    order by l.created_at desc
    limit 5
  )
  union all
  (
    select c.id, cc.name, c.name, 'client',
      case when cc.phone_key = {{schema}}.lead_phone_key(p_phone) then 'phone' else 'email' end
    from {{schema}}.client_contacts cc
    join {{schema}}.clients c on c.id = cc.client_id
    where c.source_lead_id is distinct from p_exclude
      and (
        cc.phone_key = {{schema}}.lead_phone_key(p_phone)
        or (nullif(trim(p_email), '') is not null and lower(cc.email) = lower(trim(p_email)))
      )
    order by cc.created_at desc
    limit 5
  );
$$;

alter table {{schema}}.clients enable row level security;
alter table {{schema}}.client_contacts enable row level security;
alter table {{schema}}.contracts enable row level security;
alter table {{schema}}.deployments enable row level security;
alter table {{schema}}.subscriptions enable row level security;
alter table {{schema}}.client_documents enable row level security;

-- Access: verified admins read and keep these records (AUTH-01). Clients, contracts,
-- deployments and subscriptions are never deleted (end or pause them instead);
-- contacts and documents can be removed. Every change is in the activity log.
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'client_contacts', 'contracts', 'deployments', 'subscriptions', 'client_documents']
  loop
    execute format(
      'create policy %1$s_read on {{schema}}.%1$s for select to authenticated using ((select {{schema}}.current_admin_ok()))', t);
    execute format(
      'create policy %1$s_add on {{schema}}.%1$s for insert to authenticated with check ((select {{schema}}.current_admin_ok()))', t);
    execute format(
      'create policy %1$s_change on {{schema}}.%1$s for update to authenticated using ((select {{schema}}.current_admin_ok())) with check ((select {{schema}}.current_admin_ok()))', t);
    perform {{schema}}.enable_audit(format('{{schema}}.%s', t)::regclass);
  end loop;
end;
$$;

create policy client_contacts_remove on {{schema}}.client_contacts
  for delete to authenticated using ((select {{schema}}.current_admin_ok()) and not is_primary);
create policy client_documents_remove on {{schema}}.client_documents
  for delete to authenticated using ((select {{schema}}.current_admin_ok()));
revoke delete on {{schema}}.clients, {{schema}}.contracts, {{schema}}.deployments, {{schema}}.subscriptions
  from authenticated;
