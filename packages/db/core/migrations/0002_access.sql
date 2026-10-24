-- Access control for every client schema (SPEC.md 4.3).
-- Supabase Auth is shared by all clients in a project, so access is decided by an
-- active membership row in *this* schema. Product migrations add their own role
-- policies; the core grants administrators access to the shared tables.

-- Privileges: no access for anon (4.3.4); authenticated users reach tables only
-- through row-level security. Later migrations inherit the same defaults.
revoke all on schema {{schema}} from public, anon;
grant usage on schema {{schema}} to authenticated, service_role;

revoke all on all tables in schema {{schema}} from public, anon;
grant select, insert, update, delete on all tables in schema {{schema}} to authenticated;
grant all on all tables in schema {{schema}} to service_role;
revoke all on {{schema}}._migrations from authenticated;

alter default privileges in schema {{schema}} revoke all on tables from public, anon;
alter default privileges in schema {{schema}} grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema {{schema}} grant all on tables to service_role;
alter default privileges in schema {{schema}} revoke all on sequences from public, anon;
alter default privileges in schema {{schema}} grant usage, select on sequences to authenticated, service_role;
-- Postgres grants EXECUTE on new functions to PUBLIC and that default cannot be
-- revoked per schema, so the migration runner revokes it from PUBLIC and anon on
-- every function in the schema after each run. Grant functions explicitly.

-- Membership helpers. SECURITY DEFINER so policies on memberships do not recurse;
-- search_path is empty so every name below is schema-qualified.

-- True when the current user has an active membership with one of `roles` in this schema.
create function {{schema}}.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from {{schema}}.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

-- True when the current user has any active membership in this schema.
create function {{schema}}.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from {{schema}}.memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Active roles of the current user in this schema.
create function {{schema}}.current_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.role order by m.role), '{}')
  from {{schema}}.memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

-- Administrator roles across products: School Super Admin, Clinic Admin, Finance Owner.
create function {{schema}}.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['super_admin', 'admin', 'owner']);
$$;

revoke execute on function {{schema}}.has_role(text[]) from public, anon;
revoke execute on function {{schema}}.is_member() from public, anon;
revoke execute on function {{schema}}.current_roles() from public, anon;
revoke execute on function {{schema}}.is_admin() from public, anon;
grant execute on function {{schema}}.has_role(text[]) to authenticated, service_role;
grant execute on function {{schema}}.is_member() to authenticated, service_role;
grant execute on function {{schema}}.current_roles() to authenticated, service_role;
grant execute on function {{schema}}.is_admin() to authenticated, service_role;

-- settings: every member reads; administrators update. The row is created at provisioning.
create policy settings_member_read on {{schema}}.settings
  for select to authenticated using ((select {{schema}}.is_member()));
create policy settings_admin_update on {{schema}}.settings
  for update to authenticated
  using ((select {{schema}}.is_admin()))
  with check ((select {{schema}}.is_admin()));

-- memberships: users see their own rows; administrators manage the schema's users.
-- Rows are suspended rather than deleted.
create policy memberships_read on {{schema}}.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or (select {{schema}}.is_admin()));
create policy memberships_admin_insert on {{schema}}.memberships
  for insert to authenticated with check ((select {{schema}}.is_admin()));
create policy memberships_admin_update on {{schema}}.memberships
  for update to authenticated
  using ((select {{schema}}.is_admin()))
  with check ((select {{schema}}.is_admin()));

-- Administrators manage the shared tables. Products add policies for their own roles
-- (bursar, cashier, accountant, ...). Billing records are never deleted (CORE-07),
-- so there are no delete policies.
create policy files_admin_read on {{schema}}.files
  for select to authenticated using ((select {{schema}}.is_admin()));
create policy files_admin_insert on {{schema}}.files
  for insert to authenticated with check ((select {{schema}}.is_admin()));

create policy announcements_admin_read on {{schema}}.announcements
  for select to authenticated using ((select {{schema}}.is_admin()));
create policy announcements_admin_insert on {{schema}}.announcements
  for insert to authenticated with check ((select {{schema}}.is_admin()));
create policy announcements_admin_update on {{schema}}.announcements
  for update to authenticated
  using ((select {{schema}}.is_admin()))
  with check ((select {{schema}}.is_admin()));
create policy announcements_admin_delete on {{schema}}.announcements
  for delete to authenticated using ((select {{schema}}.is_admin()));

create policy invoices_admin_read on {{schema}}.invoices
  for select to authenticated using ((select {{schema}}.is_admin()));
create policy invoice_lines_admin_read on {{schema}}.invoice_lines
  for select to authenticated using ((select {{schema}}.is_admin()));
create policy payments_admin_read on {{schema}}.payments
  for select to authenticated using ((select {{schema}}.is_admin()));
create policy receipts_admin_read on {{schema}}.receipts
  for select to authenticated using ((select {{schema}}.is_admin()));

-- One email address belongs to one client per Supabase project (SPEC.md 4.3.7):
-- a user who is a member of another client schema cannot be added here, whether
-- by provisioning, an administrator in the app, or the API.
create function {{schema}}.enforce_single_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other record;
  found boolean;
begin
  -- Only administrators and server scripts can add members; anyone else is
  -- rejected by row-level security, without learning about other organizations.
  if (select auth.uid()) is not null and not {{schema}}.is_admin() then
    return new;
  end if;
  for other in
    select table_schema from information_schema.tables
    where table_name = 'memberships'
      and table_schema <> '{{schema}}'
      and table_schema not in ('auth', 'storage', 'public')
  loop
    execute format('select exists (select 1 from %I.memberships where user_id = $1)', other.table_schema)
      into found using new.user_id;
    if found then
      raise exception 'This user already belongs to another organization in this project'
        using errcode = '23505', hint = 'Use a different email address for this organization.';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function {{schema}}.enforce_single_client() from public, anon, authenticated;

create trigger memberships_single_client
  before insert or update of user_id on {{schema}}.memberships
  for each row execute function {{schema}}.enforce_single_client();
