-- Quotes with lines and demo visits (audit round, owner-approved A1 and F3).
--
-- A lead's quote can list its lines (what is included, quantity, unit price); the total
-- is then their sum, worked out here so the PDF and the lead always agree. A quote gets
-- a number (QT-YY-MM-001) the first time it is saved, kept when it changes.
--
-- Demo visits: each sign-in on a public demo is counted per day, demo and role. No
-- address or person is stored, only the count.

alter table {{schema}}.document_counters
  drop constraint document_counters_kind_check,
  add constraint document_counters_kind_check check (kind in ('invoice', 'receipt', 'quote'));

alter table {{schema}}.leads
  add column quote_lines jsonb
    check (quote_lines is null or (
      jsonb_typeof(quote_lines) = 'array'
      and jsonb_array_length(quote_lines) between 1 and 12
    )),
  add column quote_number text unique;

-- Each line: {"description": text (1-200), "quantity": 1-1000, "unit_amount_minor": >= 0}.
create function {{schema}}.quote_lines_total(p_lines jsonb)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line jsonb;
  v_total bigint := 0;
  v_quantity numeric;
  v_unit numeric;
begin
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object'
      or length(trim(coalesce(v_line ->> 'description', ''))) not between 1 and 200 then
      raise exception 'Each quote line needs a description of up to 200 characters'
        using errcode = '23514';
    end if;
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_unit := (v_line ->> 'unit_amount_minor')::numeric;
    if v_quantity is null or v_quantity <> trunc(v_quantity) or v_quantity not between 1 and 1000
      or v_unit is null or v_unit <> trunc(v_unit) or v_unit < 0 or v_unit > 1e13 then
      raise exception 'Each quote line needs a whole quantity and an amount' using errcode = '23514';
    end if;
    v_total := v_total + (v_quantity * v_unit)::bigint;
  end loop;
  return v_total;
end;
$$;

grant execute on function {{schema}}.quote_lines_total(jsonb) to authenticated, service_role;

create function {{schema}}.leads_quote_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_on date := {{schema}}.today_monrovia();
begin
  if new.quote_lines is not null then
    new.quote_amount_minor := {{schema}}.quote_lines_total(new.quote_lines);
    if new.quote_amount_minor <= 0 then
      raise exception 'A quote needs a total above zero' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.quote_number is not null then
    new.quote_number := old.quote_number;
  elsif new.quote_amount_minor is not null and new.quote_number is null then
    insert into {{schema}}.document_counters (kind, year, last_number)
    values ('quote', extract(year from v_on)::integer, 1)
    on conflict (kind, year) do update set last_number = {{schema}}.document_counters.last_number + 1
    returning last_number into v_next;
    new.quote_number := 'QT-' || to_char(v_on, 'YY-MM') || '-'
      || case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.leads_quote_fill() from public, anon, authenticated;

create trigger leads_quote_fill before insert or update on {{schema}}.leads
  for each row execute function {{schema}}.leads_quote_fill();

-- Demo visits, counted by the server when a demo reports a sign-in.
create table {{schema}}.demo_visits (
  day date not null,
  demo text not null check (demo in ('college', 'highschool', 'clinic', 'finance')),
  role text not null check (role ~ '^[a-z][a-z0-9_]{0,30}$'),
  sign_ins integer not null default 0 check (sign_ins >= 0),
  primary key (day, demo, role)
);
alter table {{schema}}.demo_visits enable row level security;
create policy demo_visits_read on {{schema}}.demo_visits
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
revoke insert, update, delete on {{schema}}.demo_visits from authenticated;

create function {{schema}}.record_demo_visit(p_demo text, p_role text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into {{schema}}.demo_visits (day, demo, role, sign_ins)
  values ({{schema}}.today_monrovia(), p_demo, p_role, 1)
  on conflict (day, demo, role) do update set sign_ins = {{schema}}.demo_visits.sign_ins + 1;
$$;

revoke execute on function {{schema}}.record_demo_visit(text, text) from public, anon, authenticated;
grant execute on function {{schema}}.record_demo_visit(text, text) to service_role;
