-- System status (audit round, owner-approved A3): the admin checks each client system
-- and each public site every 10 minutes, keeps 30 days of results, and tells the team
-- when one goes down or comes back. Results are written only by the server (service
-- role); admins read them.

create table {{schema}}.status_checks (
  id bigint generated always as identity primary key,
  target text not null check (length(trim(target)) between 1 and 120),
  url text not null check (url ~ '^https://' and length(url) <= 200),
  deployment_id uuid references {{schema}}.deployments (id) on delete cascade,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  status_code integer check (status_code is null or status_code between 100 and 599),
  response_ms integer check (response_ms is null or response_ms >= 0),
  error text check (error is null or length(error) <= 200)
);
create index status_checks_url_idx on {{schema}}.status_checks (url, checked_at desc);
create index status_checks_time_idx on {{schema}}.status_checks (checked_at);

alter table {{schema}}.status_checks enable row level security;
create policy status_checks_read on {{schema}}.status_checks
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.status_checks from authenticated;

-- Saves one round of checks, removes results older than 30 days, and returns the
-- targets whose state changed since their previous check (down, or back up).
create function {{schema}}.record_status_checks(p_checks jsonb)
returns table (target text, url text, ok boolean, error text, was_ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if jsonb_typeof(p_checks) <> 'array' then
    raise exception 'Checks must be a list' using errcode = '22023';
  end if;
  return query
  with incoming as (
    select x.target, x.url, x.deployment_id, x.ok, x.status_code, x.response_ms, x.error
    from jsonb_to_recordset(p_checks) as x(
      target text, url text, deployment_id uuid, ok boolean,
      status_code integer, response_ms integer, error text
    )
  ),
  previous as (
    select distinct on (s.url) s.url, s.ok
    from {{schema}}.status_checks s
    where s.url in (select i.url from incoming i)
    order by s.url, s.checked_at desc
  ),
  saved as (
    insert into {{schema}}.status_checks (target, url, deployment_id, ok, status_code, response_ms, error)
    select i.target, i.url, i.deployment_id, i.ok, i.status_code, i.response_ms, left(i.error, 200)
    from incoming i
    returning status_checks.target, status_checks.url, status_checks.ok, status_checks.error
  )
  select s.target, s.url, s.ok, s.error, p.ok
  from saved s
  join previous p on p.url = s.url
  where p.ok is distinct from s.ok;

  delete from {{schema}}.status_checks where checked_at < now() - interval '30 days';
end;
$$;

revoke execute on function {{schema}}.record_status_checks(jsonb) from public, anon, authenticated;
grant execute on function {{schema}}.record_status_checks(jsonb) to service_role;

-- One row per checked address: its latest result and how often it was up in the last
-- 24 hours and 7 days (percent, one decimal), and since when it has been down.
create function {{schema}}.status_overview()
returns table (
  target text,
  url text,
  deployment_id uuid,
  ok boolean,
  status_code integer,
  response_ms integer,
  error text,
  checked_at timestamptz,
  up_24h numeric,
  up_7d numeric,
  down_since timestamptz
)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (s.url) s.*
    from {{schema}}.status_checks s
    where s.checked_at > now() - interval '7 days'
    order by s.url, s.checked_at desc
  )
  select l.target, l.url, l.deployment_id, l.ok, l.status_code, l.response_ms, l.error, l.checked_at,
    (select round(100.0 * count(*) filter (where s.ok) / nullif(count(*), 0), 1)
       from {{schema}}.status_checks s
       where s.url = l.url and s.checked_at > now() - interval '24 hours'),
    (select round(100.0 * count(*) filter (where s.ok) / nullif(count(*), 0), 1)
       from {{schema}}.status_checks s
       where s.url = l.url and s.checked_at > now() - interval '7 days'),
    case when not l.ok then (
      select coalesce(min(s.checked_at), l.checked_at)
      from {{schema}}.status_checks s
      where s.url = l.url and not s.ok
        and s.checked_at > coalesce(
          (select max(u.checked_at) from {{schema}}.status_checks u where u.url = l.url and u.ok),
          '-infinity'::timestamptz)
    ) end
  from latest l
  order by l.ok, l.target;
$$;

revoke execute on function {{schema}}.status_overview() from public, anon;
grant execute on function {{schema}}.status_overview() to authenticated, service_role;
