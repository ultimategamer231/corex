-- Corex's own website data (SPEC.md 4.1, 6.6), in schema corex_web of the website
-- project. Not a client schema: no memberships; only the website server writes here,
-- with that project's service-role key (owner decision, PROGRESS.md).

create table {{schema}}.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  organization text not null check (length(trim(organization)) between 2 and 150),
  country text not null check (length(trim(country)) between 2 and 60),
  product text not null,
  plan_interest text not null default 'unsure' check (plan_interest in ('managed', 'handover', 'unsure')),
  phone text not null check (length(phone) between 7 and 25),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (length(trim(message)) between 10 and 2000),
  consent boolean not null check (consent),
  source_page text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  created_at timestamptz not null default now()
);
create index leads_created_at_idx on {{schema}}.leads (created_at desc);

-- Fixed-window counters for rate limits (quote form: 5 per IP per hour).
create table {{schema}}.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table {{schema}}.leads enable row level security;
alter table {{schema}}.rate_limits enable row level security;

revoke all on schema {{schema}} from public, anon, authenticated;
revoke all on all tables in schema {{schema}} from public, anon, authenticated;
grant usage on schema {{schema}} to service_role;
grant all on all tables in schema {{schema}} to service_role;

-- Counts one hit for `p_key` in the current window; true while within the limit.
-- Old windows are removed as it goes.
create function {{schema}}.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into {{schema}}.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = {{schema}}.rate_limits.hits + 1
  returning hits into v_hits;
  delete from {{schema}}.rate_limits where window_start < v_window - make_interval(secs => p_window_seconds);
  return v_hits <= p_limit;
end;
$$;

revoke execute on function {{schema}}.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function {{schema}}.hit_rate_limit(text, integer, integer) to service_role;
