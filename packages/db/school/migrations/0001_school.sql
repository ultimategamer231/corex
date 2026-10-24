-- School Management, shared by both editions (SPEC.md 7.1, 7.2, 7.5).
-- Roles: super_admin, registrar, bursar, instructor (College), teacher and parent
-- (High School), student. Policies give each role only what SPEC 7.1 allows; writes
-- that carry rules (corrections, invoicing) go through the functions below.

-- Fee work is done by the Bursar; administrators keep access (replaces the core default).
create or replace function {{schema}}.billing_roles()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['super_admin', 'admin', 'owner', 'bursar'];
$$;

-- Registrar or Super Admin: academic records, admissions, approvals.
create function {{schema}}.is_registrar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['super_admin', 'registrar']);
$$;

-- Staff who may look up any student: Super Admin, Registrar, Bursar.
create function {{schema}}.is_school_office()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['super_admin', 'registrar', 'bursar']);
$$;

grant execute on function {{schema}}.is_registrar() to authenticated, service_role;
grant execute on function {{schema}}.is_school_office() to authenticated, service_role;

-- Active members with a role, for assigning instructors and teachers. Office staff
-- only; returns names, never emails (memberships themselves stay admin-only).
create function {{schema}}.members_with_role(p_role text)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.display_name
  from {{schema}}.memberships m
  where m.role = p_role and m.status = 'active' and {{schema}}.is_school_office()
  order by m.display_name;
$$;

grant execute on function {{schema}}.members_with_role(text) to authenticated;

-- Academic calendar ----------------------------------------------------------------

create table {{schema}}.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index academic_years_one_current on {{schema}}.academic_years (is_current) where is_current;

create table {{schema}}.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references {{schema}}.academic_years (id),
  name text not null check (length(trim(name)) > 0),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  is_current boolean not null default false,
  -- College: course registration window (SPEC.md 7.3, course planning).
  registration_opens_on date,
  registration_closes_on date,
  created_at timestamptz not null default now(),
  unique (academic_year_id, name),
  check ((registration_opens_on is null) = (registration_closes_on is null)),
  check (registration_closes_on is null or registration_closes_on >= registration_opens_on)
);
create unique index terms_one_current on {{schema}}.terms (is_current) where is_current;

-- Students and guardians -------------------------------------------------------------

-- Next student number per admission year (SCH-01); written only by the trigger below.
create table {{schema}}.student_number_sequences (
  year integer primary key,
  last_number integer not null default 0
);

create table {{schema}}.students (
  id uuid primary key default gen_random_uuid(),
  -- <prefix>-<year>-<seq>, generated on insert and never changed (SCH-01).
  student_number text not null unique,
  first_name text not null check (length(trim(first_name)) > 0),
  middle_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  sex text check (sex in ('female', 'male')),
  date_of_birth date,
  phone text,
  email text,
  address text,
  photo_file_id uuid references {{schema}}.files (id),
  status text not null default 'active' check (status in ('active', 'withdrawn', 'graduated', 'suspended')),
  -- Portal login, created by the Super Admin (SPEC.md 5.3).
  user_id uuid unique references auth.users (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index students_name_idx on {{schema}}.students (lower(last_name), lower(first_name));

create table {{schema}}.guardians (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  relationship text,
  phone text,
  email text,
  -- Parent login (High School).
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table {{schema}}.student_guardians (
  student_id uuid not null references {{schema}}.students (id),
  guardian_id uuid not null references {{schema}}.guardians (id),
  is_primary boolean not null default false,
  primary key (student_id, guardian_id)
);
create unique index student_guardians_one_primary on {{schema}}.student_guardians (student_id) where is_primary;

-- Generates the student number in the school's time zone: STU-2026-0001.
create function {{schema}}.assign_student_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_year integer;
  v_seq integer;
begin
  if tg_op = 'UPDATE' then
    if new.student_number is distinct from old.student_number then
      raise exception 'Student numbers cannot be changed' using errcode = '23514';
    end if;
    return new;
  end if;
  select coalesce(nullif(trim(s.config ->> 'student_number_prefix'), ''), 'STU'),
         extract(year from now() at time zone s.timezone)::integer
    into v_prefix, v_year
  from {{schema}}.settings s;
  v_year := coalesce(v_year, extract(year from now())::integer);
  insert into {{schema}}.student_number_sequences as q (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = q.last_number + 1
  returning last_number into v_seq;
  new.student_number := format('%s-%s-%s', coalesce(v_prefix, 'STU'), v_year, lpad(v_seq::text, 4, '0'));
  return new;
end;
$$;

revoke execute on function {{schema}}.assign_student_number() from authenticated;

create trigger students_number
  before insert or update of student_number on {{schema}}.students
  for each row execute function {{schema}}.assign_student_number();

-- Students the signed-in user may see as "own": the student's own record, or a
-- parent's linked children (High School).
create function {{schema}}.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from {{schema}}.students s
  where s.user_id = (select auth.uid()) and {{schema}}.has_role(array['student'])
  union
  select sg.student_id
  from {{schema}}.student_guardians sg
  join {{schema}}.guardians g on g.id = sg.guardian_id
  where g.user_id = (select auth.uid()) and {{schema}}.has_role(array['parent']);
$$;

grant execute on function {{schema}}.my_student_ids() to authenticated, service_role;

-- Likely duplicates of a new admission: same name and date of birth (SCH-01).
create function {{schema}}.find_possible_duplicates(p_first_name text, p_last_name text, p_date_of_birth date)
returns setof {{schema}}.students
language sql
stable
set search_path = ''
as $$
  select * from {{schema}}.students s
  where lower(trim(s.first_name)) = lower(trim(p_first_name))
    and lower(trim(s.last_name)) = lower(trim(p_last_name))
    and s.date_of_birth is not distinct from p_date_of_birth;
$$;

grant execute on function {{schema}}.find_possible_duplicates(text, text, date) to authenticated;

-- Attendance -----------------------------------------------------------------------

create table {{schema}}.attendance (
  -- Generated by the device so offline records sync once (CORE-06).
  id uuid primary key,
  date date not null,
  student_id uuid not null references {{schema}}.students (id),
  -- College: a course offering. High School: a section.
  class_ref_type text not null check (class_ref_type in ('offering', 'section')),
  class_ref_id uuid not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  recorded_by uuid default auth.uid(),
  note text,
  created_at timestamptz not null default now(),
  unique (date, student_id, class_ref_type, class_ref_id)
);
create index attendance_class_idx on {{schema}}.attendance (class_ref_type, class_ref_id, date);
create index attendance_student_idx on {{schema}}.attendance (student_id, date);

-- Registrar correction with a mandatory reason, kept in the audit log (SPEC.md 7.5).
create function {{schema}}.correct_attendance(p_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can correct attendance' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', p_reason, true);
  update {{schema}}.attendance set status = p_status where id = p_id;
  if not found then
    raise exception 'Attendance record not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function {{schema}}.correct_attendance(uuid, text, text) to authenticated;

-- Fees -----------------------------------------------------------------------------

create table {{schema}}.fee_structures (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references {{schema}}.academic_years (id),
  -- Null: charged every term of the year.
  term_id uuid references {{schema}}.terms (id),
  -- A program code (College), a grade level name (High School), or 'all'.
  applies_to text not null default 'all' check (length(trim(applies_to)) > 0),
  item text not null check (length(trim(item)) > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  created_at timestamptz not null default now()
);

-- One fee invoice per student, term and currency, so bulk generation can be re-run
-- safely (D22).
create table {{schema}}.term_invoices (
  term_id uuid not null references {{schema}}.terms (id),
  student_id uuid not null references {{schema}}.students (id),
  currency text not null check (currency in ('USD', 'LRD')),
  invoice_id uuid not null unique references {{schema}}.invoices (id),
  primary key (term_id, student_id, currency)
);

-- Balance per student and currency over issued, unpaid invoices: the debtor list
-- (SPEC.md 7.5). Never sums across currencies (CORE-05).
create view {{schema}}.student_balances
with (security_invoker = true)
as
select
  i.party_id as student_id,
  i.currency,
  sum(b.total_minor)::bigint as billed_minor,
  sum(b.paid_minor)::bigint as paid_minor,
  sum(b.total_minor - b.paid_minor)::bigint as balance_minor,
  count(*)::integer as open_invoices
from {{schema}}.invoices i
join {{schema}}.invoice_balances b on b.invoice_id = i.id
where i.party_type = 'student' and i.status in ('issued', 'partially_paid')
group by i.party_id, i.currency;

grant select on {{schema}}.student_balances to authenticated;

-- Fees collected and outstanding per currency for the dashboard (SPEC.md 7.5).
create view {{schema}}.fee_totals
with (security_invoker = true)
as
select
  i.currency,
  coalesce(sum(b.paid_minor), 0)::bigint as collected_minor,
  coalesce(sum(b.total_minor - b.paid_minor) filter (where i.status in ('issued', 'partially_paid')), 0)::bigint
    as outstanding_minor
from {{schema}}.invoices i
join {{schema}}.invoice_balances b on b.invoice_id = i.id
where i.party_type = 'student' and i.status not in ('draft', 'void')
group by i.currency;

grant select on {{schema}}.fee_totals to authenticated;

-- Row-level security ----------------------------------------------------------------

alter table {{schema}}.academic_years enable row level security;
alter table {{schema}}.terms enable row level security;
alter table {{schema}}.student_number_sequences enable row level security;
alter table {{schema}}.students enable row level security;
alter table {{schema}}.guardians enable row level security;
alter table {{schema}}.student_guardians enable row level security;
alter table {{schema}}.attendance enable row level security;
alter table {{schema}}.fee_structures enable row level security;
alter table {{schema}}.term_invoices enable row level security;

revoke all on {{schema}}.student_number_sequences from authenticated;
-- Corrections go through correct_attendance; term invoices through the generator.
revoke update, delete on {{schema}}.attendance from authenticated;
revoke insert, update, delete on {{schema}}.term_invoices from authenticated;

create policy academic_years_read on {{schema}}.academic_years
  for select to authenticated using ((select {{schema}}.is_member()));
create policy academic_years_write on {{schema}}.academic_years
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy terms_read on {{schema}}.terms
  for select to authenticated using ((select {{schema}}.is_member()));
create policy terms_write on {{schema}}.terms
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy students_office_read on {{schema}}.students
  for select to authenticated using ((select {{schema}}.is_school_office()));
create policy students_own_read on {{schema}}.students
  for select to authenticated using (id in (select {{schema}}.my_student_ids()));
create policy students_registrar_insert on {{schema}}.students
  for insert to authenticated with check ((select {{schema}}.is_registrar()));
create policy students_registrar_update on {{schema}}.students
  for update to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy guardians_office_read on {{schema}}.guardians
  for select to authenticated using ((select {{schema}}.is_school_office()));
create policy guardians_own_read on {{schema}}.guardians
  for select to authenticated using (user_id = (select auth.uid()));
create policy guardians_registrar_insert on {{schema}}.guardians
  for insert to authenticated with check ((select {{schema}}.is_registrar()));
create policy guardians_registrar_update on {{schema}}.guardians
  for update to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy student_guardians_office_read on {{schema}}.student_guardians
  for select to authenticated using ((select {{schema}}.is_school_office()));
create policy student_guardians_own_read on {{schema}}.student_guardians
  for select to authenticated using (student_id in (select {{schema}}.my_student_ids()));
create policy student_guardians_registrar_write on {{schema}}.student_guardians
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy attendance_registrar_read on {{schema}}.attendance
  for select to authenticated using ((select {{schema}}.is_registrar()));
create policy attendance_own_read on {{schema}}.attendance
  for select to authenticated using (student_id in (select {{schema}}.my_student_ids()));

create policy fee_structures_read on {{schema}}.fee_structures
  for select to authenticated using ((select {{schema}}.is_school_office()));
create policy fee_structures_billing_write on {{schema}}.fee_structures
  for all to authenticated
  using ((select {{schema}}.can_bill())) with check ((select {{schema}}.can_bill()));

create policy term_invoices_billing_read on {{schema}}.term_invoices
  for select to authenticated using ((select {{schema}}.can_bill()));

-- Students and parents read their own fee invoices, payments and receipts (portal).
create policy invoices_own_read on {{schema}}.invoices
  for select to authenticated
  using (party_type = 'student' and status <> 'draft' and party_id in (select {{schema}}.my_student_ids()));
create policy invoice_lines_own_read on {{schema}}.invoice_lines
  for select to authenticated
  using (invoice_id in (
    select i.id from {{schema}}.invoices i
    where i.party_type = 'student' and i.status <> 'draft' and i.party_id in (select {{schema}}.my_student_ids())
  ));
create policy payments_own_read on {{schema}}.payments
  for select to authenticated
  using (invoice_id in (
    select i.id from {{schema}}.invoices i
    where i.party_type = 'student' and i.party_id in (select {{schema}}.my_student_ids())
  ));
create policy receipts_own_read on {{schema}}.receipts
  for select to authenticated
  using (payment_id in (
    select p.id from {{schema}}.payments p
    join {{schema}}.invoices i on i.id = p.invoice_id
    where i.party_type = 'student' and i.party_id in (select {{schema}}.my_student_ids())
  ));

-- Announcements: the Registrar publishes; members read those addressed to their roles.
create policy announcements_registrar_read on {{schema}}.announcements
  for select to authenticated using ((select {{schema}}.is_registrar()));
create policy announcements_registrar_insert on {{schema}}.announcements
  for insert to authenticated with check ((select {{schema}}.is_registrar()));
create policy announcements_registrar_update on {{schema}}.announcements
  for update to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy announcements_audience_read on {{schema}}.announcements
  for select to authenticated
  using (
    published_at is not null and published_at <= now()
    and (cardinality(audience_roles) = 0 or audience_roles && (select {{schema}}.current_roles()))
  );

select {{schema}}.enable_audit('{{schema}}.academic_years');
select {{schema}}.enable_audit('{{schema}}.terms');
select {{schema}}.enable_audit('{{schema}}.students');
select {{schema}}.enable_audit('{{schema}}.guardians');
select {{schema}}.enable_audit('{{schema}}.student_guardians');
select {{schema}}.enable_audit('{{schema}}.attendance');
select {{schema}}.enable_audit('{{schema}}.fee_structures');
select {{schema}}.enable_audit('{{schema}}.term_invoices');
