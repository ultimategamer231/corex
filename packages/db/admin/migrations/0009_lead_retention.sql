-- Quote request retention (audit round F5; owner decision 2026-11-17). The Privacy
-- Policy promises that a quote request that does not lead to a contract is deleted 1
-- year after our last contact. purge_stale_leads() does that once a day: a lead never
-- converted to a client, with no contact (creation, change, stage change or timeline
-- entry) for a year, is deleted with its timeline. The activity log keeps its record of
-- the request, as the Privacy Policy says. Leads stay undeletable for everyone else.

-- True only inside purge_stale_leads(): the setting alone is not enough, because anyone
-- can set it; the delete must also run as the function's owner, which app roles are not.
create function {{schema}}.retention_purging()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('corex.retention', true), '') = 'on'
    and current_user not in ('anon', 'authenticated', 'service_role');
$$;

revoke execute on function {{schema}}.retention_purging() from public, anon;
grant execute on function {{schema}}.retention_purging() to authenticated, service_role;

create or replace function {{schema}}.leads_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and {{schema}}.retention_purging() then
    return old;
  end if;
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
  if tg_op = 'DELETE' and {{schema}}.retention_purging() then
    return old;
  end if;
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

create function {{schema}}.purge_stale_leads(p_before timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before timestamptz := coalesce(p_before, now() - interval '1 year');
  v_ids uuid[];
begin
  select coalesce(array_agg(l.id), '{}') into v_ids
  from {{schema}}.leads l
  where l.converted_client_id is null
    and not exists (select 1 from {{schema}}.clients c where c.source_lead_id = l.id)
    and greatest(l.created_at, l.updated_at, coalesce(l.stage_changed_at, l.created_at)) < v_before
    and not exists (
      select 1 from {{schema}}.lead_activities a
      where a.lead_id = l.id and a.created_at >= v_before
    )
    and (l.follow_up_on is null or l.follow_up_on < v_before::date);
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  perform set_config('corex.retention', 'on', true);
  delete from {{schema}}.lead_activities where lead_id = any(v_ids);
  delete from {{schema}}.leads where id = any(v_ids);
  perform set_config('corex.retention', '', true);
  return cardinality(v_ids);
end;
$$;

revoke execute on function {{schema}}.purge_stale_leads(timestamptz) from public, anon, authenticated;
grant execute on function {{schema}}.purge_stale_leads(timestamptz) to service_role;
