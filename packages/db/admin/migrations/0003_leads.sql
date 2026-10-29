-- Leads (SPEC-ADMIN.md 4, 8.1; PROGRESS.md Admin A2). The website's leads table is
-- extended for follow-up work: stage, assignment, follow-up, quote. Website requests
-- keep every original field as submitted (LEAD-01); leads added by hand need a name,
-- an organization and a phone or email (LEAD-02). Notes and activities are
-- append-only (LEAD-05) and every stage change adds one (LEAD-04).

-- The website never set status; it becomes the stage, with "Demo booked" added.
alter table {{schema}}.leads rename column status to stage;
alter table {{schema}}.leads
  drop constraint leads_status_check,
  add constraint leads_stage_check
    check (stage in ('new', 'contacted', 'demo_booked', 'quoted', 'won', 'lost'));

-- Website-only requirements move into one rule, so hand-added leads can leave them out.
alter table {{schema}}.leads
  drop constraint leads_country_check,
  drop constraint leads_phone_check,
  drop constraint leads_message_check,
  drop constraint leads_consent_check,
  alter column country drop not null,
  alter column product drop not null,
  alter column phone drop not null,
  alter column message drop not null,
  alter column consent drop not null;

-- Last 8 digits of a phone number, so "+231 77 123 4567" and "0771234567" match (LEAD-03).
create function {{schema}}.lead_phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
      then right(regexp_replace(p_phone, '\D', '', 'g'), 8)
  end;
$$;

grant execute on function {{schema}}.lead_phone_key(text) to authenticated, service_role;

alter table {{schema}}.leads
  add column source text not null default 'website' check (source in ('website', 'manual')),
  add column assigned_admin_id uuid references {{schema}}.admins (id),
  add column follow_up_on date,
  add column next_step text check (next_step is null or length(next_step) <= 300),
  add column lost_reason text check (lost_reason is null or length(trim(lost_reason)) between 3 and 500),
  add column quote_amount_minor bigint check (quote_amount_minor is null or quote_amount_minor > 0),
  add column quote_currency text check (quote_currency in ('USD', 'LRD')),
  -- The day the quote was sent (SPEC-ADMIN.md quote_sent_at; a date is what admins know).
  add column quote_sent_on date,
  add column quote_note text check (quote_note is null or length(quote_note) <= 500),
  -- Set once by the conversion in Block A3, which adds the reference to clients.
  add column converted_client_id uuid,
  add column stage_changed_at timestamptz,
  add column phone_key text generated always as ({{schema}}.lead_phone_key(phone)) stored,
  add column updated_at timestamptz not null default now(),
  add column created_by uuid default auth.uid(),
  add constraint leads_country_check check (country is null or length(trim(country)) between 2 and 60),
  add constraint leads_phone_check check (phone is null or length(phone) between 7 and 25),
  add constraint leads_message_check check (message is null or length(trim(message)) between 1 and 2000),
  add constraint leads_contact_check check (phone is not null or email is not null),
  add constraint leads_website_check check (
    source <> 'website' or (
      country is not null and product is not null and phone is not null
      and message is not null and length(trim(message)) >= 10 and consent
    )
  ),
  add constraint leads_lost_needs_reason check (stage <> 'lost' or lost_reason is not null),
  add constraint leads_quote_pair check ((quote_amount_minor is null) = (quote_currency is null));

create index leads_stage_idx on {{schema}}.leads (stage, created_at desc);
create index leads_assigned_idx on {{schema}}.leads (assigned_admin_id);
create index leads_follow_up_idx on {{schema}}.leads (follow_up_on) where follow_up_on is not null;
create index leads_phone_key_idx on {{schema}}.leads (phone_key) where phone_key is not null;
create index leads_email_idx on {{schema}}.leads (lower(email)) where email is not null;

-- The timeline of a lead (SPEC-ADMIN.md 4). Admins add notes, calls, WhatsApp
-- messages, meetings and demos; the database adds the form, stage and quote entries.
create table {{schema}}.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references {{schema}}.leads (id) on delete restrict,
  type text not null
    check (type in ('note', 'call', 'whatsapp', 'meeting', 'demo', 'stage_change', 'form', 'quote')),
  body text not null check (length(trim(body)) between 1 and 2000),
  admin_id uuid references {{schema}}.admins (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index lead_activities_lead_idx on {{schema}}.lead_activities (lead_id, created_at desc);

alter table {{schema}}.lead_activities enable row level security;

-- The admin row of the signed-in user, or null for the website and server jobs.
create function {{schema}}.current_admin_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from {{schema}}.admins a where a.user_id = (select auth.uid());
$$;

revoke execute on function {{schema}}.current_admin_id() from public, anon;
grant execute on function {{schema}}.current_admin_id() to authenticated, service_role;

create function {{schema}}.lead_stage_label(p_stage text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'new' then 'New'
    when 'contacted' then 'Contacted'
    when 'demo_booked' then 'Demo booked'
    when 'quoted' then 'Quoted'
    when 'won' then 'Won'
    when 'lost' then 'Lost'
    else p_stage
  end;
$$;

-- "US$4,000.00" or "L$12,500.00". Amounts are integer minor units (CORE-04).
create function {{schema}}.money_text(p_minor bigint, p_currency text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_currency when 'USD' then 'US$' when 'LRD' then 'L$' else p_currency || ' ' end
    || to_char(p_minor / 100.0, 'FM999,999,999,990.00');
$$;

grant execute on function {{schema}}.lead_stage_label(text) to authenticated, service_role;
grant execute on function {{schema}}.money_text(bigint, text) to authenticated, service_role;

-- LEAD-01: a website request stays as it was sent. Nobody changes where a lead came
-- from, when it arrived or which client it became.
create function {{schema}}.leads_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

revoke execute on function {{schema}}.leads_guard() from public, anon, authenticated;

create trigger leads_guard
  before update or delete on {{schema}}.leads
  for each row execute function {{schema}}.leads_guard();

-- Timeline entries the database writes: the website form (LEAD-01), every stage
-- change (LEAD-04) and each quote.
create function {{schema}}.leads_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := {{schema}}.current_admin_id();
begin
  if tg_op = 'INSERT' then
    if new.source = 'website' then
      insert into {{schema}}.lead_activities (lead_id, type, body)
      values (
        new.id,
        'form',
        'Quote request submitted on the website' || coalesce(' (' || new.source_page || ')', '') || '.'
      );
    end if;
    return new;
  end if;

  if new.stage is distinct from old.stage then
    insert into {{schema}}.lead_activities (lead_id, type, body, admin_id)
    values (
      new.id,
      'stage_change',
      'Stage changed from ' || {{schema}}.lead_stage_label(old.stage) || ' to '
        || {{schema}}.lead_stage_label(new.stage)
        || case when new.stage = 'lost' then '. Reason: ' || new.lost_reason else '' end
        || '.',
      v_admin
    );
  end if;
  if new.quote_amount_minor is not null and (
    new.quote_amount_minor, new.quote_currency, new.quote_sent_on, new.quote_note
  ) is distinct from (
    old.quote_amount_minor, old.quote_currency, old.quote_sent_on, old.quote_note
  ) then
    insert into {{schema}}.lead_activities (lead_id, type, body, admin_id)
    values (
      new.id,
      'quote',
      'Quote ' || case when new.quote_sent_on is null then 'prepared' else 'sent '
        || to_char(new.quote_sent_on, 'FMDD Mon YYYY') end
        || ': ' || {{schema}}.money_text(new.quote_amount_minor, new.quote_currency)
        || coalesce('. ' || new.quote_note, '') || '.',
      v_admin
    );
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.leads_timeline() from public, anon, authenticated;

create trigger leads_timeline
  after insert or update on {{schema}}.leads
  for each row execute function {{schema}}.leads_timeline();

-- LEAD-05: entries are never changed or removed, by anyone. An admin's entry is
-- always signed with their own name.
create function {{schema}}.lead_activities_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

revoke execute on function {{schema}}.lead_activities_guard() from public, anon, authenticated;

create trigger lead_activities_guard
  before insert or update or delete on {{schema}}.lead_activities
  for each row execute function {{schema}}.lead_activities_guard();

-- Activity log: website requests are logged as the website, hand-added leads as the
-- admin who added them; changes and timeline entries through the core audit trigger.
create function {{schema}}.leads_audit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into {{schema}}.audit_events (actor_id, actor_type, action, table_name, record_id, after, summary)
  values (
    (select auth.uid()),
    case when new.source = 'website' and (select auth.uid()) is null then 'website' else 'admin' end,
    'create',
    'leads',
    new.id::text,
    to_jsonb(new),
    case when new.source = 'website'
      then 'Website quote request from ' || new.organization
      else 'Added lead ' || new.organization
    end
  );
  return new;
end;
$$;

revoke execute on function {{schema}}.leads_audit_insert() from public, anon, authenticated;

create trigger audit_lead_insert after insert on {{schema}}.leads
  for each row execute function {{schema}}.leads_audit_insert();
create trigger audit_row after update or delete on {{schema}}.leads
  for each row execute function {{schema}}.audit_row();
select {{schema}}.enable_audit('{{schema}}.lead_activities');

-- Likely duplicates of a phone number or email among the other leads (LEAD-03).
-- Client contacts join the check in Block A3. Runs with the caller's access.
create function {{schema}}.lead_duplicates(p_phone text, p_email text, p_exclude uuid default null)
returns table (id uuid, name text, organization text, stage text, matched_on text)
language sql
stable
set search_path = ''
as $$
  select l.id, l.name, l.organization, l.stage,
    case when l.phone_key = {{schema}}.lead_phone_key(p_phone) then 'phone' else 'email' end
  from {{schema}}.leads l
  where l.id is distinct from p_exclude
    and (
      l.phone_key = {{schema}}.lead_phone_key(p_phone)
      or (nullif(trim(p_email), '') is not null and lower(l.email) = lower(trim(p_email)))
    )
  order by l.created_at desc
  limit 5;
$$;

revoke execute on function {{schema}}.lead_duplicates(text, text, uuid) from public, anon;
grant execute on function {{schema}}.lead_duplicates(text, text, uuid) to authenticated, service_role;

-- Access: verified admins read and work leads (AUTH-01). They add leads by hand only;
-- website requests come from the website server. Nobody deletes a lead.
create policy leads_read on {{schema}}.leads
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy leads_add on {{schema}}.leads
  for insert to authenticated
  with check ((select {{schema}}.current_admin_ok()) and source = 'manual');
create policy leads_work on {{schema}}.leads
  for update to authenticated
  using ((select {{schema}}.current_admin_ok()))
  with check ((select {{schema}}.current_admin_ok()));
revoke delete on {{schema}}.leads from authenticated;

create policy lead_activities_read on {{schema}}.lead_activities
  for select to authenticated using ((select {{schema}}.current_admin_ok()));
create policy lead_activities_add on {{schema}}.lead_activities
  for insert to authenticated
  with check (
    (select {{schema}}.current_admin_ok())
    and type in ('note', 'call', 'whatsapp', 'meeting', 'demo')
  );
revoke update, delete on {{schema}}.lead_activities from authenticated;
