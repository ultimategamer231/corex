-- Signing in updates auth.users (last sign-in time). The guard that keeps demo
-- passwords published looked up this schema's members on every such update, so while
-- a nightly reset held this schema's tables, every sign-in in the project waited for
-- it. It now looks only when a password, email or phone actually changes.

create or replace function {{schema}}.demo_protect_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user = 'supabase_auth_admin'
    and (new.encrypted_password is distinct from old.encrypted_password
      or new.email is distinct from old.email
      or new.phone is distinct from old.phone)
    and exists (select 1 from {{schema}}.memberships m where m.user_id = old.id) then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.phone := old.phone;
  end if;
  return new;
end;
$$;
