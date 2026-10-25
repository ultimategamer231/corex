-- Clinic Management (SPEC.md 8): patients, appointments, walk-in queue, encounters
-- with vitals and versioned clinical notes, a service price list and patient bills on
-- the shared billing tables.
-- Roles: admin (settings, users, price list, operational reports), clinician (notes
-- and full history), nurse (vitals and intake), receptionist (patients, appointments,
-- queue), cashier (bills, payments, receipts). Clinical notes and vitals are visible
-- only to clinicians (both) and nurses (vitals) (CLN-01).

-- Roles -------------------------------------------------------------------------

-- Bills are the Cashier's; the core billing functions check this list.
create or replace function {{schema}}.billing_roles()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cashier'];
$$;

create function {{schema}}.is_clinician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['clinician']);
$$;

-- Clinician or Nurse: vitals and intake.
create function {{schema}}.is_clinical()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['clinician', 'nurse']);
$$;

-- Front desk work (patients, appointments, queue): Receptionist and clinical staff.
create function {{schema}}.is_front_desk()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['receptionist', 'clinician', 'nurse']);
$$;

grant execute on function {{schema}}.is_clinician() to authenticated, service_role;
grant execute on function {{schema}}.is_clinical() to authenticated, service_role;
grant execute on function {{schema}}.is_front_desk() to authenticated, service_role;

-- Clinicians who can be booked, with display names, for any member's lists.
create function {{schema}}.clinicians()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.display_name
  from {{schema}}.memberships m
  where m.role = 'clinician' and m.status = 'active' and {{schema}}.is_member()
  order by m.display_name;
$$;

grant execute on function {{schema}}.clinicians() to authenticated;

-- Audit rows about notes and vitals stay hidden from administrators (CLN-01).
create or replace function {{schema}}.audit_row_visible(p_table_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_table_name not in ('clinical_notes', 'vitals') or {{schema}}.has_role(array['clinician']);
$$;

-- Patients ----------------------------------------------------------------------

create table {{schema}}.patient_number_sequences (
  year integer primary key,
  last_number integer not null default 0
);

create table {{schema}}.patients (
  -- Made by the device, so a registration made offline syncs once.
  id uuid primary key,
  patient_number text not null unique,
  first_name text not null check (length(trim(first_name)) > 0),
  middle_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  sex text check (sex in ('female', 'male')),
  date_of_birth date,
  phone text,
  address text,
  next_of_kin_name text,
  next_of_kin_phone text,
  has_allergies boolean not null default false,
  allergy_notes text,
  -- Flag only; merging is not in the MVP (CLN-08).
  possible_duplicate_of uuid references {{schema}}.patients (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (not has_allergies or length(trim(coalesce(allergy_notes, ''))) > 0)
);

create index patients_name_idx on {{schema}}.patients (lower(last_name), lower(first_name));

-- Digits of a phone number without the country code, for comparing numbers.
create function {{schema}}.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9), '');
$$;

-- Patient number (PT-2026-00001) and the possible-duplicate flag (CLN-08): same
-- name and date of birth, or the same phone number, as an earlier patient.
create function {{schema}}.patients_before_insert()
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
    if new.patient_number is distinct from old.patient_number then
      raise exception 'Patient numbers cannot be changed' using errcode = '23514';
    end if;
    return new;
  end if;
  select coalesce(nullif(trim(s.config ->> 'patient_number_prefix'), ''), 'PT'),
         extract(year from now() at time zone s.timezone)::integer
    into v_prefix, v_year
  from {{schema}}.settings s;
  v_year := coalesce(v_year, extract(year from now())::integer);
  insert into {{schema}}.patient_number_sequences as q (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = q.last_number + 1
  returning last_number into v_seq;
  new.patient_number := format('%s-%s-%s', coalesce(v_prefix, 'PT'), v_year, lpad(v_seq::text, 5, '0'));

  if new.possible_duplicate_of is null then
    select p.id into new.possible_duplicate_of
    from {{schema}}.patients p
    where p.id <> new.id
      and (
        (lower(trim(p.first_name)) = lower(trim(new.first_name))
          and lower(trim(p.last_name)) = lower(trim(new.last_name))
          and p.date_of_birth = new.date_of_birth)
        or {{schema}}.phone_key(p.phone) = {{schema}}.phone_key(new.phone)
      )
    order by p.created_at
    limit 1;
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.patients_before_insert() from authenticated;

create trigger patients_before_insert
  before insert or update of patient_number on {{schema}}.patients
  for each row execute function {{schema}}.patients_before_insert();

-- Appointments ------------------------------------------------------------------

create table {{schema}}.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references {{schema}}.patients (id),
  -- The clinician's user (memberships have no id of their own, D21).
  clinician_id uuid not null references auth.users (id),
  starts_at timestamptz not null,
  duration_minutes integer not null default 20 check (duration_minutes between 5 and 480),
  reason text,
  status text not null default 'booked'
    check (status in ('booked', 'checked_in', 'completed', 'cancelled', 'no_show')),
  cancel_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0)
);

create index appointments_clinician_idx on {{schema}}.appointments (clinician_id, starts_at);
create index appointments_patient_idx on {{schema}}.appointments (patient_id, starts_at);

-- One clinician, one patient at a time (CLN-04). Bookings for a clinician are
-- serialized with a lock so two receptionists cannot both take the same slot.
create function {{schema}}.appointments_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clash record;
  v_tz text;
begin
  if new.status not in ('booked', 'checked_in') then
    return new;
  end if;
  if not exists (
    select 1 from {{schema}}.memberships m
    where m.user_id = new.clinician_id and m.role = 'clinician' and m.status = 'active'
  ) then
    raise exception 'Choose a clinician for the appointment' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtext('{{schema}}.appointments.' || new.clinician_id::text));
  select a.starts_at, a.duration_minutes into v_clash
  from {{schema}}.appointments a
  where a.clinician_id = new.clinician_id
    and a.id <> new.id
    and a.status in ('booked', 'checked_in')
    and tstzrange(a.starts_at, a.starts_at + make_interval(mins => a.duration_minutes))
        && tstzrange(new.starts_at, new.starts_at + make_interval(mins => new.duration_minutes))
  limit 1;
  if found then
    select timezone into v_tz from {{schema}}.settings;
    raise exception 'This clinician already has an appointment from % to %. Choose another time.',
      to_char(v_clash.starts_at at time zone coalesce(v_tz, 'Africa/Monrovia'), 'HH24:MI'),
      to_char((v_clash.starts_at + make_interval(mins => v_clash.duration_minutes)) at time zone coalesce(v_tz, 'Africa/Monrovia'), 'HH24:MI')
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.appointments_no_overlap() from authenticated;

create trigger appointments_no_overlap
  before insert or update of starts_at, duration_minutes, clinician_id, status on {{schema}}.appointments
  for each row execute function {{schema}}.appointments_no_overlap();

-- Cancelled appointments stay in the history (CLN-05).
create trigger appointments_never_delete before delete on {{schema}}.appointments
  for each row execute function {{schema}}.never_delete();

-- Visits ------------------------------------------------------------------------

create table {{schema}}.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references {{schema}}.patients (id),
  appointment_id uuid unique references {{schema}}.appointments (id),
  clinician_id uuid not null references auth.users (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'closed') = (closed_at is not null))
);

create index encounters_patient_idx on {{schema}}.encounters (patient_id, opened_at desc);
create index encounters_opened_idx on {{schema}}.encounters (opened_at);

create table {{schema}}.queue_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references {{schema}}.patients (id),
  appointment_id uuid references {{schema}}.appointments (id),
  arrived_at timestamptz not null default now(),
  status text not null default 'waiting'
    check (status in ('waiting', 'with_nurse', 'with_clinician', 'done')),
  encounter_id uuid references {{schema}}.encounters (id),
  created_by uuid default auth.uid()
);

create index queue_entries_arrived_idx on {{schema}}.queue_entries (arrived_at);

create table {{schema}}.vitals (
  -- Made by the device: vitals may be recorded offline (SPEC.md 10).
  id uuid primary key,
  -- Null while offline; linked when the visit is known.
  encounter_id uuid references {{schema}}.encounters (id),
  patient_id uuid not null references {{schema}}.patients (id),
  temperature_c numeric(4, 1) check (temperature_c between 30 and 45),
  pulse_bpm integer check (pulse_bpm between 20 and 250),
  bp_systolic integer check (bp_systolic between 50 and 260),
  bp_diastolic integer check (bp_diastolic between 30 and 160),
  resp_rate integer check (resp_rate between 4 and 80),
  weight_kg numeric(5, 1) check (weight_kg between 0.5 and 400),
  height_cm numeric(5, 1) check (height_cm between 20 and 250),
  spo2 integer check (spo2 between 50 and 100),
  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now(),
  check ((bp_systolic is null) = (bp_diastolic is null)),
  check (coalesce(temperature_c::text, pulse_bpm::text, bp_systolic::text, resp_rate::text,
                  weight_kg::text, height_cm::text, spo2::text) is not null)
);

create index vitals_patient_idx on {{schema}}.vitals (patient_id, recorded_at desc);

create table {{schema}}.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references {{schema}}.encounters (id),
  complaints text,
  history text,
  examination text,
  -- Diagnosis text.
  assessment text,
  plan text,
  prescriptions_text text,
  author_id uuid not null default auth.uid() references auth.users (id),
  version integer not null default 1 check (version >= 1),
  -- A correction points at the signed note it replaces (CLN-03).
  supersedes_id uuid unique references {{schema}}.clinical_notes (id),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinical_notes_encounter_idx on {{schema}}.clinical_notes (encounter_id, version);

-- Signed notes are never edited in place (CLN-03); drafts change only by their author.
create function {{schema}}.clinical_notes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.signed_at is not null then
      raise exception 'Signed notes are never deleted; add a correction instead' using errcode = '23514';
    end if;
    return old;
  end if;
  if old.signed_at is not null then
    raise exception 'Signed notes cannot be edited; add a correction instead' using errcode = '23514';
  end if;
  if new.encounter_id <> old.encounter_id or new.author_id <> old.author_id
    or new.version <> old.version or new.supersedes_id is distinct from old.supersedes_id then
    raise exception 'A note cannot move to another visit or author' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger clinical_notes_guard before update or delete on {{schema}}.clinical_notes
  for each row execute function {{schema}}.clinical_notes_guard();

-- Signs the author's own draft.
create function {{schema}}.sign_note(p_note_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note {{schema}}.clinical_notes%rowtype;
begin
  if not {{schema}}.is_clinician() then
    raise exception 'Only a clinician can sign notes' using errcode = '42501';
  end if;
  select * into v_note from {{schema}}.clinical_notes where id = p_note_id for update;
  if not found then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;
  if v_note.author_id <> (select auth.uid()) then
    raise exception 'Only the author can sign this note' using errcode = '42501';
  end if;
  if v_note.signed_at is not null then
    raise exception 'This note is already signed' using errcode = '23514';
  end if;
  if length(trim(coalesce(v_note.assessment, '') || coalesce(v_note.plan, '') || coalesce(v_note.complaints, ''))) = 0 then
    raise exception 'Write the complaint, assessment or plan before signing' using errcode = '23514';
  end if;
  update {{schema}}.clinical_notes set signed_at = now() where id = p_note_id;
  return now();
end;
$$;

grant execute on function {{schema}}.sign_note(uuid) to authenticated;

-- Starts a correction of a signed note: a new draft version that supersedes it, with
-- the same text to edit (CLN-03). The signed note stays in the history.
create function {{schema}}.amend_note(p_note_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note {{schema}}.clinical_notes%rowtype;
  v_id uuid;
begin
  if not {{schema}}.is_clinician() then
    raise exception 'Only a clinician can correct notes' using errcode = '42501';
  end if;
  select * into v_note from {{schema}}.clinical_notes where id = p_note_id for update;
  if not found then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;
  if v_note.signed_at is null then
    raise exception 'Edit the draft instead; only signed notes are corrected' using errcode = '23514';
  end if;
  select id into v_id from {{schema}}.clinical_notes where supersedes_id = p_note_id;
  if found then
    return v_id;
  end if;
  insert into {{schema}}.clinical_notes (
    encounter_id, complaints, history, examination, assessment, plan, prescriptions_text,
    author_id, version, supersedes_id
  ) values (
    v_note.encounter_id, v_note.complaints, v_note.history, v_note.examination, v_note.assessment,
    v_note.plan, v_note.prescriptions_text, (select auth.uid()), v_note.version + 1, v_note.id
  ) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function {{schema}}.amend_note(uuid) to authenticated;

-- Checks a booked patient in: the appointment moves on and the patient joins the queue.
create function {{schema}}.check_in(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt {{schema}}.appointments%rowtype;
  v_entry uuid;
begin
  if not {{schema}}.has_role(array['receptionist', 'nurse', 'clinician']) then
    raise exception 'Only the front desk can check patients in' using errcode = '42501';
  end if;
  select * into v_appt from {{schema}}.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  if v_appt.status <> 'booked' then
    raise exception 'Only a booked appointment can be checked in' using errcode = '23514';
  end if;
  update {{schema}}.appointments set status = 'checked_in' where id = p_appointment_id;
  insert into {{schema}}.queue_entries (patient_id, appointment_id)
  values (v_appt.patient_id, p_appointment_id)
  returning id into v_entry;
  return v_entry;
end;
$$;

grant execute on function {{schema}}.check_in(uuid) to authenticated;

-- Opens the visit for a patient waiting in the queue (Clinician).
create function {{schema}}.start_encounter(p_queue_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry {{schema}}.queue_entries%rowtype;
  v_id uuid;
begin
  if not {{schema}}.is_clinician() then
    raise exception 'Only a clinician can open a visit' using errcode = '42501';
  end if;
  select * into v_entry from {{schema}}.queue_entries where id = p_queue_entry_id for update;
  if not found then
    raise exception 'Queue entry not found' using errcode = 'P0002';
  end if;
  if v_entry.encounter_id is not null then
    return v_entry.encounter_id;
  end if;
  if v_entry.status = 'done' then
    raise exception 'This patient has already left the queue' using errcode = '23514';
  end if;
  insert into {{schema}}.encounters (patient_id, appointment_id, clinician_id)
  values (v_entry.patient_id, v_entry.appointment_id, (select auth.uid()))
  returning id into v_id;
  update {{schema}}.queue_entries set status = 'with_clinician', encounter_id = v_id
  where id = p_queue_entry_id;
  -- Vitals taken at intake before the visit opened belong to it.
  update {{schema}}.vitals set encounter_id = v_id
  where patient_id = v_entry.patient_id and encounter_id is null
    and recorded_at >= v_entry.arrived_at - interval '1 hour';
  return v_id;
end;
$$;

grant execute on function {{schema}}.start_encounter(uuid) to authenticated;

-- Closes a visit: its queue entry is done and its appointment completed.
create function {{schema}}.close_encounter(p_encounter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enc {{schema}}.encounters%rowtype;
begin
  if not {{schema}}.is_clinician() then
    raise exception 'Only a clinician can close a visit' using errcode = '42501';
  end if;
  select * into v_enc from {{schema}}.encounters where id = p_encounter_id for update;
  if not found then
    raise exception 'Visit not found' using errcode = 'P0002';
  end if;
  if v_enc.status = 'closed' then
    return;
  end if;
  if exists (
    select 1 from {{schema}}.clinical_notes n where n.encounter_id = p_encounter_id and n.signed_at is null
  ) then
    raise exception 'Sign or delete the draft note before closing the visit' using errcode = '23514';
  end if;
  update {{schema}}.encounters set status = 'closed', closed_at = now() where id = p_encounter_id;
  update {{schema}}.queue_entries set status = 'done' where encounter_id = p_encounter_id;
  update {{schema}}.appointments set status = 'completed'
  where id = v_enc.appointment_id and status = 'checked_in';
end;
$$;

grant execute on function {{schema}}.close_encounter(uuid) to authenticated;

-- Services and bills -------------------------------------------------------------

create table {{schema}}.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  price_minor bigint not null check (price_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create trigger services_never_delete before delete on {{schema}}.services
  for each row execute function {{schema}}.never_delete();

-- Who pays the bill (SPEC.md 8.2), and the visit it is for.
alter table {{schema}}.invoices
  add column payer_type text not null default 'self' check (payer_type in ('self', 'insurance', 'company')),
  add column payer_name text,
  add column encounter_id uuid references {{schema}}.encounters (id),
  add constraint invoices_payer_named check (payer_type = 'self' or length(trim(coalesce(payer_name, ''))) > 0);

-- Clinic bills are for patients.
create function {{schema}}.invoices_patient_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.party_type <> 'patient'
    or not exists (select 1 from {{schema}}.patients p where p.id = new.party_id) then
    raise exception 'Choose the patient for the bill' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoices_patient_check before insert on {{schema}}.invoices
  for each row execute function {{schema}}.invoices_patient_check();

-- Access --------------------------------------------------------------------------

alter table {{schema}}.patient_number_sequences enable row level security;
alter table {{schema}}.patients enable row level security;
alter table {{schema}}.appointments enable row level security;
alter table {{schema}}.encounters enable row level security;
alter table {{schema}}.queue_entries enable row level security;
alter table {{schema}}.vitals enable row level security;
alter table {{schema}}.clinical_notes enable row level security;
alter table {{schema}}.services enable row level security;

revoke all on {{schema}}.patient_number_sequences from authenticated;

-- Demographics, appointments, visits and the queue hold no clinical detail; every
-- member reads them (the cashier bills patients, the admin reports on visits).
create policy patients_read on {{schema}}.patients
  for select to authenticated using ((select {{schema}}.is_member()));
create policy patients_insert on {{schema}}.patients
  for insert to authenticated with check ((select {{schema}}.is_front_desk()));
create policy patients_update on {{schema}}.patients
  for update to authenticated
  using ((select {{schema}}.is_front_desk())) with check ((select {{schema}}.is_front_desk()));

create policy appointments_read on {{schema}}.appointments
  for select to authenticated using ((select {{schema}}.is_member()));
create policy appointments_insert on {{schema}}.appointments
  for insert to authenticated with check ((select {{schema}}.is_front_desk()) and status = 'booked');
create policy appointments_update on {{schema}}.appointments
  for update to authenticated
  using ((select {{schema}}.is_front_desk())) with check ((select {{schema}}.is_front_desk()));

create policy encounters_read on {{schema}}.encounters
  for select to authenticated using ((select {{schema}}.is_member()));
revoke insert, update, delete on {{schema}}.encounters from authenticated;

create policy queue_read on {{schema}}.queue_entries
  for select to authenticated using ((select {{schema}}.is_member()));
create policy queue_insert on {{schema}}.queue_entries
  for insert to authenticated
  with check ((select {{schema}}.is_front_desk()) and status = 'waiting' and encounter_id is null);
create policy queue_update on {{schema}}.queue_entries
  for update to authenticated
  using ((select {{schema}}.is_front_desk())) with check ((select {{schema}}.is_front_desk()));

-- Vitals: Clinician and Nurse only (CLN-01). Recorded, never edited.
create policy vitals_clinical_read on {{schema}}.vitals
  for select to authenticated using ((select {{schema}}.is_clinical()));
create policy vitals_clinical_insert on {{schema}}.vitals
  for insert to authenticated
  with check ((select {{schema}}.is_clinical()) and recorded_by = (select auth.uid()));
revoke update, delete on {{schema}}.vitals from authenticated;

-- Notes: Clinicians only (CLN-01); drafts are written and deleted by their author.
create policy notes_clinician_read on {{schema}}.clinical_notes
  for select to authenticated using ((select {{schema}}.is_clinician()));
create policy notes_clinician_insert on {{schema}}.clinical_notes
  for insert to authenticated
  with check (
    (select {{schema}}.is_clinician()) and author_id = (select auth.uid())
    and signed_at is null and version = 1 and supersedes_id is null
  );
create policy notes_author_update on {{schema}}.clinical_notes
  for update to authenticated
  using ((select {{schema}}.is_clinician()) and author_id = (select auth.uid()) and signed_at is null)
  with check ((select {{schema}}.is_clinician()) and author_id = (select auth.uid()) and signed_at is null);
create policy notes_author_delete on {{schema}}.clinical_notes
  for delete to authenticated
  using ((select {{schema}}.is_clinician()) and author_id = (select auth.uid()) and signed_at is null);

create policy services_read on {{schema}}.services
  for select to authenticated using ((select {{schema}}.is_member()));
create policy services_admin_write on {{schema}}.services
  for all to authenticated
  using ((select {{schema}}.is_admin())) with check ((select {{schema}}.is_admin()));

-- Patient attachments follow clinical permissions (CLN-06): their file records are
-- hidden even from administrators unless they are also clinical staff. The files
-- themselves are served through short-lived signed links after the same check.
create policy files_patients_clinical_only on {{schema}}.files
  as restrictive for select to authenticated
  using (owner_table <> 'patients' or (select {{schema}}.is_clinical()));
create policy files_clinical_insert on {{schema}}.files
  for insert to authenticated
  with check (owner_table = 'patients' and (select {{schema}}.is_clinical()));
create policy files_clinical_read on {{schema}}.files
  for select to authenticated
  using (owner_table = 'patients' and (select {{schema}}.is_clinical()));

-- Audit (CORE-03) ---------------------------------------------------------------------

select {{schema}}.enable_audit('{{schema}}.patients');
select {{schema}}.enable_audit('{{schema}}.appointments');
select {{schema}}.enable_audit('{{schema}}.encounters');
select {{schema}}.enable_audit('{{schema}}.queue_entries');
select {{schema}}.enable_audit('{{schema}}.vitals');
select {{schema}}.enable_audit('{{schema}}.clinical_notes');
select {{schema}}.enable_audit('{{schema}}.services');
