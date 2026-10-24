-- Core tables present in every client schema (SPEC.md 5.1).
-- Money is bigint minor units plus a currency code (CORE-04). Primary keys are
-- UUIDs a client may generate offline (CORE-06). Row-level security is enabled
-- on every table; policies are added in 0002 (core) and in product migrations.

-- Organization settings: exactly one row (CORE-01).
create table {{schema}}.settings (
  id boolean primary key default true check (id),
  org_name text not null check (length(trim(org_name)) > 0),
  logo_path text,
  address text,
  phone text,
  email text,
  letterhead_text text,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'LRD')),
  enabled_currencies text[] not null default array['USD', 'LRD']
    check (enabled_currencies <@ array['USD', 'LRD'] and cardinality(enabled_currencies) > 0),
  timezone text not null default 'Africa/Monrovia',
  -- Product-specific settings, for example max_credits_per_term or pass_mark.
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  check (base_currency = any (enabled_currencies))
);

-- Who may act in this schema (SPEC.md 4.3). One row per user and role, so a
-- user can hold two roles (for example Admin and Clinician, SPEC.md 8.1).
create table {{schema}}.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role ~ '^[a-z][a-z_]*$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Append-only history of changes to business records (CORE-03).
create table {{schema}}.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null
    check (action in ('create', 'update', 'delete', 'view', 'approve', 'void', 'login')),
  table_name text not null,
  record_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_events_record_idx on {{schema}}.audit_events (table_name, record_id);
create index audit_events_created_at_idx on {{schema}}.audit_events (created_at desc);

-- Uploaded files; the object lives in this client's storage bucket.
create table {{schema}}.files (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null unique,
  owner_table text not null,
  owner_id uuid not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index files_owner_idx on {{schema}}.files (owner_table, owner_id);

create table {{schema}}.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text not null,
  audience_roles text[] not null default '{}',
  audience_filter jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Shared billing: school fees, clinic bills and finance sales invoices (SPEC.md 5.1).
create table {{schema}}.invoices (
  id uuid primary key default gen_random_uuid(),
  -- Sequential per schema, assigned when issued and never reused (CORE-08, Phase 3).
  number bigint unique check (number > 0),
  party_type text not null,
  party_id uuid not null,
  currency text not null check (currency in ('USD', 'LRD')),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  issue_date date,
  due_date date check (due_date is null or issue_date is null or due_date >= issue_date),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (status = 'draft' or number is not null)
);
create index invoices_party_idx on {{schema}}.invoices (party_type, party_id);

create table {{schema}}.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references {{schema}}.invoices (id),
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  created_at timestamptz not null default now()
);
create index invoice_lines_invoice_idx on {{schema}}.invoice_lines (invoice_id);

create table {{schema}}.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references {{schema}}.invoices (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  method text not null check (method in ('cash', 'mobile_money', 'bank', 'other')),
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid default auth.uid(),
  status text not null default 'posted' check (status in ('posted', 'void')),
  void_reason text,
  -- A void must say why (CORE-07).
  check (status <> 'void' or length(trim(coalesce(void_reason, ''))) > 0)
);
create index payments_invoice_idx on {{schema}}.payments (invoice_id);

create table {{schema}}.receipts (
  id uuid primary key default gen_random_uuid(),
  -- Sequential per schema and never reused (CORE-08, Phase 3).
  number bigint not null unique check (number > 0),
  payment_id uuid not null unique references {{schema}}.payments (id),
  issued_at timestamptz not null default now()
);

alter table {{schema}}.settings enable row level security;
alter table {{schema}}.memberships enable row level security;
alter table {{schema}}.audit_events enable row level security;
alter table {{schema}}.files enable row level security;
alter table {{schema}}.announcements enable row level security;
alter table {{schema}}.invoices enable row level security;
alter table {{schema}}.invoice_lines enable row level security;
alter table {{schema}}.payments enable row level security;
alter table {{schema}}.receipts enable row level security;
