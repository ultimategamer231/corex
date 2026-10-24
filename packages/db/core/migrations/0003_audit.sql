-- Audit trail (CORE-03): every create, update, delete, approve and void on a
-- business record writes an audit_events row with actor_id = auth.uid().
-- Server code can attach a reason for the next change in the same transaction:
--   select set_config('corex.audit_reason', 'Corrected by registrar', true);

create function {{schema}}.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
    v_after := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_before := to_jsonb(old);
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    -- Updates that change nothing are not history.
    if v_before = v_after then
      return new;
    end if;
    v_action := case
      when (v_after ->> 'status') is distinct from (v_before ->> 'status')
        and v_after ->> 'status' = 'void' then 'void'
      when (v_after ->> 'status') is distinct from (v_before ->> 'status')
        and v_after ->> 'status' = 'approved' then 'approve'
      else 'update'
    end;
  end if;

  insert into {{schema}}.audit_events (actor_id, action, table_name, record_id, before, after, reason)
  values (
    (select auth.uid()),
    v_action,
    tg_table_name,
    coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'user_id', v_before ->> 'user_id'),
    v_before,
    v_after,
    coalesce(nullif(current_setting('corex.audit_reason', true), ''), v_after ->> 'void_reason')
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function {{schema}}.audit_row() from public, anon, authenticated;

-- Attaches the audit trigger to a business table. Product migrations call this for
-- each of their tables: select {{schema}}.enable_audit('{{schema}}.students');
create function {{schema}}.enable_audit(target regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger audit_row after insert or update or delete on %s for each row execute function {{schema}}.audit_row()',
    target
  );
end;
$$;

revoke execute on function {{schema}}.enable_audit(regclass) from public, anon, authenticated;

select {{schema}}.enable_audit('{{schema}}.settings');
select {{schema}}.enable_audit('{{schema}}.memberships');
select {{schema}}.enable_audit('{{schema}}.files');
select {{schema}}.enable_audit('{{schema}}.announcements');
select {{schema}}.enable_audit('{{schema}}.invoices');
select {{schema}}.enable_audit('{{schema}}.invoice_lines');
select {{schema}}.enable_audit('{{schema}}.payments');
select {{schema}}.enable_audit('{{schema}}.receipts');

-- The audit log is append-only for everyone, including the service role.
-- (Demo resets clear it with TRUNCATE, which these row triggers do not cover.)
create function {{schema}}.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end;
$$;

revoke execute on function {{schema}}.audit_events_append_only() from public, anon, authenticated;

create trigger audit_events_append_only
  before update or delete on {{schema}}.audit_events
  for each row execute function {{schema}}.audit_events_append_only();

revoke insert, update, delete on {{schema}}.audit_events from authenticated;

-- Records that the signed-in user opened a record, for example a patient's
-- clinical file (CLN-02). Server code calls it with the user's own session after
-- its permission check, so the audit row names the real viewer. The table must
-- exist in this schema and the record must exist, so the log cannot be filled
-- with views of nothing.
create function {{schema}}.log_view(p_table_name text, p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_exists boolean;
begin
  if (select auth.uid()) is null or not {{schema}}.is_member() then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  if p_table_name is null or p_table_name like '\_%' or to_regclass(format('{{schema}}.%I', p_table_name)) is null then
    raise exception 'unknown table %', p_table_name using errcode = '42P01';
  end if;
  execute format('select exists (select 1 from {{schema}}.%I where id = $1)', p_table_name)
    into record_exists using p_record_id;
  if not record_exists then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  insert into {{schema}}.audit_events (actor_id, action, table_name, record_id)
  values ((select auth.uid()), 'view', p_table_name, p_record_id::text);
end;
$$;

revoke execute on function {{schema}}.log_view(text, uuid) from public, anon;
grant execute on function {{schema}}.log_view(text, uuid) to authenticated;

-- Which audit rows administrators may read. Products override this to hide rows
-- that contain restricted data (for example clinical notes, CLN-01).
create function {{schema}}.audit_row_visible(p_table_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke execute on function {{schema}}.audit_row_visible(text) from public, anon;
grant execute on function {{schema}}.audit_row_visible(text) to authenticated, service_role;

create policy audit_events_admin_read on {{schema}}.audit_events
  for select to authenticated
  using ((select {{schema}}.is_admin()) and {{schema}}.audit_row_visible(table_name));
