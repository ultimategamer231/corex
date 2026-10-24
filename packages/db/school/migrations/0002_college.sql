-- College edition (SPEC.md 7.3): academic structure, course planning and grades.
-- Rules that must hold whatever the client sends (SCH-02, SCH-03, SCH-05) live in
-- the functions and triggers below; row-level security limits who sees what.

-- Academic structure ----------------------------------------------------------------

create table {{schema}}.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  created_at timestamptz not null default now()
);

create table {{schema}}.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references {{schema}}.departments (id),
  name text not null check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  award text not null check (award in ('Certificate', 'Diploma', 'Associate', 'Bachelor')),
  total_credits_required integer not null check (total_credits_required > 0),
  duration_terms integer not null check (duration_terms > 0),
  created_at timestamptz not null default now()
);

create table {{schema}}.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references {{schema}}.departments (id),
  code text not null unique check (code ~ '^[A-Z]{2,6} ?[0-9]{2,4}[A-Z]?$'),
  title text not null check (length(trim(title)) > 0),
  credits integer not null check (credits between 1 and 12),
  description text,
  created_at timestamptz not null default now()
);

create table {{schema}}.course_prerequisites (
  course_id uuid not null references {{schema}}.courses (id),
  prerequisite_course_id uuid not null references {{schema}}.courses (id),
  primary key (course_id, prerequisite_course_id),
  check (course_id <> prerequisite_course_id)
);

create table {{schema}}.program_requirements (
  program_id uuid not null references {{schema}}.programs (id),
  course_id uuid not null references {{schema}}.courses (id),
  requirement_type text not null check (requirement_type in ('core', 'elective')),
  recommended_term integer check (recommended_term >= 1),
  primary key (program_id, course_id)
);

create table {{schema}}.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references {{schema}}.students (id),
  program_id uuid not null references {{schema}}.programs (id),
  start_term_id uuid not null references {{schema}}.terms (id),
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  created_at timestamptz not null default now()
);
create unique index program_enrollments_one_active on {{schema}}.program_enrollments (student_id) where status = 'active';

create table {{schema}}.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references {{schema}}.courses (id),
  term_id uuid not null references {{schema}}.terms (id),
  section text not null default 'A' check (length(trim(section)) > 0),
  -- The instructor's auth user (memberships are keyed by user and role, D21).
  instructor_id uuid references auth.users (id),
  capacity integer not null check (capacity > 0),
  schedule_text text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (course_id, term_id, section)
);
create index course_offerings_term_idx on {{schema}}.course_offerings (term_id);
create index course_offerings_instructor_idx on {{schema}}.course_offerings (instructor_id);

create table {{schema}}.course_registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references {{schema}}.students (id),
  offering_id uuid not null references {{schema}}.course_offerings (id),
  status text not null default 'planned'
    check (status in ('planned', 'submitted', 'approved', 'rejected', 'dropped')),
  submitted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create unique index course_registrations_active
  on {{schema}}.course_registrations (student_id, offering_id) where status not in ('rejected', 'dropped');
create index course_registrations_offering_idx on {{schema}}.course_registrations (offering_id, status);

create table {{schema}}.grade_scale (
  id uuid primary key default gen_random_uuid(),
  min_score numeric(5, 2) not null check (min_score between 0 and 100),
  max_score numeric(5, 2) not null check (max_score between 0 and 100),
  letter text not null unique check (length(trim(letter)) > 0),
  -- Null for marks that do not count towards GPA.
  grade_points numeric(3, 2) check (grade_points between 0 and 5),
  is_passing boolean not null,
  check (max_score >= min_score)
);

create table {{schema}}.assessments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references {{schema}}.course_offerings (id),
  name text not null check (length(trim(name)) > 0),
  weight_percent numeric(5, 2) not null check (weight_percent > 0 and weight_percent <= 100),
  max_score numeric(6, 2) not null check (max_score > 0),
  created_at timestamptz not null default now(),
  unique (offering_id, name)
);

create table {{schema}}.assessment_scores (
  -- Generated by the device so offline entries sync once (CORE-06).
  id uuid primary key,
  assessment_id uuid not null references {{schema}}.assessments (id),
  student_id uuid not null references {{schema}}.students (id),
  score numeric(6, 2) not null check (score >= 0),
  entered_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table {{schema}}.final_grades (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references {{schema}}.course_offerings (id),
  student_id uuid not null references {{schema}}.students (id),
  numeric_score numeric(5, 2),
  letter text,
  grade_points numeric(3, 2),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'locked')),
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  locked_at timestamptz,
  unique (offering_id, student_id)
);
create index final_grades_student_idx on {{schema}}.final_grades (student_id);

-- Helpers ----------------------------------------------------------------------------

-- Today's date in the school's time zone.
create function {{schema}}.school_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (now() at time zone s.timezone)::date from {{schema}}.settings s), current_date);
$$;

-- The signed-in Student's own student id, or null.
create function {{schema}}.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from {{schema}}.students s
  where s.user_id = (select auth.uid()) and {{schema}}.has_role(array['student']);
$$;

-- True when the signed-in Instructor is assigned to the offering (SCH-02).
create function {{schema}}.teaches_offering(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['instructor']) and exists (
    select 1 from {{schema}}.course_offerings o
    where o.id = p_offering_id and o.instructor_id = (select auth.uid())
  );
$$;

-- Offerings the signed-in Instructor teaches.
create function {{schema}}.my_offering_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from {{schema}}.course_offerings o
  where o.instructor_id = (select auth.uid()) and {{schema}}.has_role(array['instructor']);
$$;

-- Students on the class lists of the signed-in Instructor.
create function {{schema}}.my_class_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.student_id from {{schema}}.course_registrations r
  where r.status = 'approved' and r.offering_id in (select {{schema}}.my_offering_ids());
$$;

-- True when the student is on the offering's class list (approved registration).
create function {{schema}}.on_class_list(p_offering_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from {{schema}}.course_registrations r
    where r.offering_id = p_offering_id and r.student_id = p_student_id and r.status = 'approved'
  );
$$;

-- True when the student has an approved or locked passing grade in the course.
create function {{schema}}.has_passed(p_student_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from {{schema}}.final_grades g
    join {{schema}}.course_offerings o on o.id = g.offering_id
    join {{schema}}.grade_scale gs on gs.letter = g.letter
    where g.student_id = p_student_id and o.course_id = p_course_id
      and g.status in ('approved', 'locked') and gs.is_passing
  );
$$;

-- A numeric setting from settings.config with a default.
create function {{schema}}.config_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.config -> p_key) = 'number' then (s.config ->> p_key)::numeric::integer end
     from {{schema}}.settings s),
    p_default
  );
$$;

-- Credits a student has planned, submitted or approved in a term.
create function {{schema}}.term_credits(p_student_id uuid, p_term_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.credits), 0)::integer
  from {{schema}}.course_registrations r
  join {{schema}}.course_offerings o on o.id = r.offering_id
  join {{schema}}.courses c on c.id = o.course_id
  where r.student_id = p_student_id and o.term_id = p_term_id
    and r.status in ('planned', 'submitted', 'approved');
$$;

grant execute on function {{schema}}.school_today() to authenticated, service_role;
grant execute on function {{schema}}.my_student_id() to authenticated, service_role;
grant execute on function {{schema}}.teaches_offering(uuid) to authenticated, service_role;
grant execute on function {{schema}}.my_offering_ids() to authenticated, service_role;
grant execute on function {{schema}}.my_class_student_ids() to authenticated, service_role;
grant execute on function {{schema}}.on_class_list(uuid, uuid) to authenticated, service_role;
grant execute on function {{schema}}.has_passed(uuid, uuid) to authenticated, service_role;
grant execute on function {{schema}}.config_int(text, integer) to authenticated, service_role;
grant execute on function {{schema}}.term_credits(uuid, uuid) to authenticated, service_role;

-- Course planning (SPEC.md 7.3) ------------------------------------------------------

-- Locks the offering row and refuses when its class list is full. Concurrent
-- approvals queue on the lock, so capacity can never be exceeded (SCH-05).
create function {{schema}}.ensure_seat(p_offering_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken integer;
  v_label text;
begin
  select o.capacity, c.code || ' section ' || o.section into v_capacity, v_label
  from {{schema}}.course_offerings o join {{schema}}.courses c on c.id = o.course_id
  where o.id = p_offering_id
  for update of o;
  if not found then
    raise exception 'Course offering not found' using errcode = 'P0002';
  end if;
  select count(*) into v_taken from {{schema}}.course_registrations
  where offering_id = p_offering_id and status = 'approved';
  if v_taken >= v_capacity then
    raise exception '% is full (% of % seats taken)', v_label, v_taken, v_capacity using errcode = '23514';
  end if;
end;
$$;

revoke execute on function {{schema}}.ensure_seat(uuid) from authenticated;

-- Adds an offering to the signed-in Student's plan, or refuses with the reason.
create function {{schema}}.plan_course(p_offering_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := {{schema}}.my_student_id();
  v_offering record;
  v_missing text;
  v_taken integer;
  v_credits integer;
  v_max integer := {{schema}}.config_int('max_credits_per_term', 21);
  v_id uuid;
begin
  if v_student is null then
    raise exception 'Only students can plan courses' using errcode = '42501';
  end if;
  select o.id, o.term_id, o.course_id, o.capacity, o.status, o.section, c.code, c.credits,
         t.registration_opens_on, t.registration_closes_on
    into v_offering
  from {{schema}}.course_offerings o
  join {{schema}}.courses c on c.id = o.course_id
  join {{schema}}.terms t on t.id = o.term_id
  where o.id = p_offering_id;
  if not found then
    raise exception 'Course offering not found' using errcode = 'P0002';
  end if;
  if v_offering.registration_opens_on is null
    or {{schema}}.school_today() not between v_offering.registration_opens_on and v_offering.registration_closes_on then
    raise exception 'Course registration for this term is closed' using errcode = '23514';
  end if;
  if v_offering.status <> 'open' then
    raise exception '% section % is closed', v_offering.code, v_offering.section using errcode = '23514';
  end if;
  if exists (
    select 1 from {{schema}}.course_registrations r
    join {{schema}}.course_offerings o on o.id = r.offering_id
    where r.student_id = v_student and o.term_id = v_offering.term_id and r.status = 'submitted'
  ) then
    raise exception 'Your plan is submitted. Ask the Registrar to return it before making changes.'
      using errcode = '23514';
  end if;
  if {{schema}}.has_passed(v_student, v_offering.course_id) then
    raise exception 'You have already passed %', v_offering.code using errcode = '23514';
  end if;
  select string_agg(c.code, ', ' order by c.code) into v_missing
  from {{schema}}.course_prerequisites p
  join {{schema}}.courses c on c.id = p.prerequisite_course_id
  where p.course_id = v_offering.course_id
    and not {{schema}}.has_passed(v_student, p.prerequisite_course_id);
  if v_missing is not null then
    raise exception '% needs % first', v_offering.code, v_missing using errcode = '23514';
  end if;
  if exists (
    select 1 from {{schema}}.course_registrations r
    join {{schema}}.course_offerings o on o.id = r.offering_id
    where r.student_id = v_student and o.term_id = v_offering.term_id
      and o.course_id = v_offering.course_id and r.status in ('planned', 'submitted', 'approved')
  ) then
    raise exception '% is already in your plan for this term', v_offering.code using errcode = '23514';
  end if;
  select count(*) into v_taken from {{schema}}.course_registrations
  where offering_id = p_offering_id and status = 'approved';
  if v_taken >= v_offering.capacity then
    raise exception '% section % is full', v_offering.code, v_offering.section using errcode = '23514';
  end if;
  v_credits := {{schema}}.term_credits(v_student, v_offering.term_id) + v_offering.credits;
  if v_credits > v_max then
    raise exception 'Adding % brings you to % credits; the limit is % per term', v_offering.code, v_credits, v_max
      using errcode = '23514';
  end if;
  insert into {{schema}}.course_registrations (student_id, offering_id, status)
  values (v_student, p_offering_id, 'planned')
  returning id into v_id;
  return v_id;
end;
$$;

-- Removes a course from the signed-in Student's unsubmitted plan.
create function {{schema}}.unplan_course(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from {{schema}}.course_registrations
  where id = p_registration_id and student_id = {{schema}}.my_student_id() and status = 'planned';
  if not found then
    raise exception 'Only courses still in your plan can be removed' using errcode = '23514';
  end if;
end;
$$;

-- Submits the signed-in Student's plan for a term. Below the minimum credits is a
-- warning only, returned to the caller.
create function {{schema}}.submit_plan(p_term_id uuid)
returns table (submitted integer, credits integer, min_credits integer, below_minimum boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := {{schema}}.my_student_id();
  v_term record;
  v_count integer;
  v_credits integer;
  v_min integer := {{schema}}.config_int('min_credits_per_term', 12);
begin
  if v_student is null then
    raise exception 'Only students can submit a course plan' using errcode = '42501';
  end if;
  select * into v_term from {{schema}}.terms where id = p_term_id;
  if not found or v_term.registration_opens_on is null
    or {{schema}}.school_today() not between v_term.registration_opens_on and v_term.registration_closes_on then
    raise exception 'Course registration for this term is closed' using errcode = '23514';
  end if;
  update {{schema}}.course_registrations r
  set status = 'submitted', submitted_at = now()
  from {{schema}}.course_offerings o
  where o.id = r.offering_id and o.term_id = p_term_id
    and r.student_id = v_student and r.status = 'planned';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Add at least one course to your plan first' using errcode = '23514';
  end if;
  v_credits := {{schema}}.term_credits(v_student, p_term_id);
  return query select v_count, v_credits, v_min, v_credits < v_min;
end;
$$;

-- Registrar returns a submitted plan to the student for changes.
create function {{schema}}.return_plan(p_student_id uuid, p_term_id uuid, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can return a plan' using errcode = '42501';
  end if;
  update {{schema}}.course_registrations r
  set status = 'planned', decision_note = nullif(trim(p_note), ''),
      decided_by = (select auth.uid()), decided_at = now()
  from {{schema}}.course_offerings o
  where o.id = r.offering_id and o.term_id = p_term_id
    and r.student_id = p_student_id and r.status = 'submitted';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Registrar approves or rejects one submitted course. Approval re-checks capacity
-- under a lock on the offering (SCH-05).
create function {{schema}}.decide_registration(p_registration_id uuid, p_approve boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg {{schema}}.course_registrations%rowtype;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can approve course registrations' using errcode = '42501';
  end if;
  select * into v_reg from {{schema}}.course_registrations where id = p_registration_id;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if p_approve then
    perform {{schema}}.ensure_seat(v_reg.offering_id);
  end if;
  -- Re-read after the lock: another approval may have decided it meanwhile.
  select * into v_reg from {{schema}}.course_registrations where id = p_registration_id for update;
  if v_reg.status <> 'submitted' then
    raise exception 'Only submitted courses can be decided (this one is %)', v_reg.status using errcode = '23514';
  end if;
  update {{schema}}.course_registrations
  set status = v_status, decided_by = (select auth.uid()), decided_at = now(),
      decision_note = nullif(trim(p_note), '')
  where id = p_registration_id;
  return v_status;
end;
$$;

-- Registrar adds a student to an offering at any time, with a reason (audited).
create function {{schema}}.registrar_register(p_student_id uuid, p_offering_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can add registrations' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  perform {{schema}}.ensure_seat(p_offering_id);
  if exists (
    select 1 from {{schema}}.course_registrations r
    join {{schema}}.course_offerings o on o.id = r.offering_id
    join {{schema}}.course_offerings n on n.id = p_offering_id
    where r.student_id = p_student_id and o.term_id = n.term_id and o.course_id = n.course_id
      and r.status in ('planned', 'submitted', 'approved')
  ) then
    raise exception 'The student is already registered for this course this term' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', p_reason, true);
  insert into {{schema}}.course_registrations (student_id, offering_id, status, decided_by, decided_at, decision_note)
  values (p_student_id, p_offering_id, 'approved', (select auth.uid()), now(), p_reason)
  returning id into v_id;
  return v_id;
end;
$$;

-- Registrar drops a registration with a reason (audited).
create function {{schema}}.registrar_drop(p_registration_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can drop registrations' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', p_reason, true);
  update {{schema}}.course_registrations
  set status = 'dropped', decided_by = (select auth.uid()), decided_at = now(), decision_note = p_reason
  where id = p_registration_id and status in ('planned', 'submitted', 'approved');
  if not found then
    raise exception 'Registration not found or already closed' using errcode = 'P0002';
  end if;
end;
$$;

-- Seats per offering in a term, for members who cannot read other registrations.
create function {{schema}}.offering_seats(p_term_id uuid)
returns table (offering_id uuid, capacity integer, taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.capacity,
         (select count(*)::integer from {{schema}}.course_registrations r
          where r.offering_id = o.id and r.status = 'approved')
  from {{schema}}.course_offerings o
  where o.term_id = p_term_id and {{schema}}.is_member();
$$;

grant execute on function {{schema}}.offering_seats(uuid) to authenticated;
grant execute on function {{schema}}.plan_course(uuid) to authenticated;
grant execute on function {{schema}}.unplan_course(uuid) to authenticated;
grant execute on function {{schema}}.submit_plan(uuid) to authenticated;
grant execute on function {{schema}}.return_plan(uuid, uuid, text) to authenticated;
grant execute on function {{schema}}.decide_registration(uuid, boolean, text) to authenticated;
grant execute on function {{schema}}.registrar_register(uuid, uuid, text) to authenticated;
grant execute on function {{schema}}.registrar_drop(uuid, text) to authenticated;

-- Grades (SPEC.md 7.3) ---------------------------------------------------------------

-- Letter and grade points for a numeric score from the institution's scale.
create function {{schema}}.grade_for(p_score numeric)
returns table (letter text, grade_points numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select gs.letter, gs.grade_points from {{schema}}.grade_scale gs
  where p_score >= gs.min_score
  order by gs.min_score desc
  limit 1;
$$;

grant execute on function {{schema}}.grade_for(numeric) to authenticated, service_role;

-- Recomputes one student's draft final grade: Σ(score / max × weight), with missing
-- scores counting as zero until submission checks they are all entered.
create function {{schema}}.recompute_final_grade(p_offering_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score numeric;
  v_letter text;
  v_points numeric;
begin
  select round(coalesce(sum(coalesce(s.score, 0) / a.max_score * a.weight_percent), 0), 2) into v_score
  from {{schema}}.assessments a
  left join {{schema}}.assessment_scores s on s.assessment_id = a.id and s.student_id = p_student_id
  where a.offering_id = p_offering_id;
  select g.letter, g.grade_points into v_letter, v_points from {{schema}}.grade_for(v_score) g;
  insert into {{schema}}.final_grades (offering_id, student_id, numeric_score, letter, grade_points)
  values (p_offering_id, p_student_id, v_score, v_letter, v_points)
  on conflict (offering_id, student_id) do update
    set numeric_score = excluded.numeric_score, letter = excluded.letter, grade_points = excluded.grade_points
    where {{schema}}.final_grades.status = 'draft';
end;
$$;

revoke execute on function {{schema}}.recompute_final_grade(uuid, uuid) from authenticated;

-- Status of a student's final grade in an offering ('draft' when none yet).
create function {{schema}}.grade_status(p_offering_id uuid, p_student_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select g.status from {{schema}}.final_grades g where g.offering_id = p_offering_id and g.student_id = p_student_id),
    'draft'
  );
$$;

revoke execute on function {{schema}}.grade_status(uuid, uuid) from authenticated;

-- Scores: only for students on the class list, within the assessment's maximum, and
-- only while the grade is a draft. Locked grades cannot be edited (SCH-03).
create function {{schema}}.assessment_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row {{schema}}.assessment_scores%rowtype := coalesce(new, old);
  v_assessment {{schema}}.assessments%rowtype;
  v_status text;
begin
  select * into v_assessment from {{schema}}.assessments where id = v_row.assessment_id;
  -- Checked before anything else so other users learn nothing about the class (SCH-02).
  if (select auth.uid()) is not null and not {{schema}}.teaches_offering(v_assessment.offering_id) then
    raise exception 'You are not assigned to this course' using errcode = '42501';
  end if;
  v_status := {{schema}}.grade_status(v_assessment.offering_id, v_row.student_id);
  if v_status <> 'draft' then
    raise exception 'This grade is %; scores cannot be changed', v_status using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.assessment_id <> old.assessment_id or new.student_id <> old.student_id) then
    raise exception 'A score cannot be moved to another assessment or student' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' then
    if not {{schema}}.on_class_list(v_assessment.offering_id, new.student_id) then
      raise exception 'The student is not on this class list' using errcode = '23514';
    end if;
    if new.score > v_assessment.max_score then
      raise exception 'Score % is above the maximum of %', new.score, v_assessment.max_score using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create function {{schema}}.assessment_scores_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row {{schema}}.assessment_scores%rowtype := coalesce(new, old);
begin
  perform {{schema}}.recompute_final_grade(a.offering_id, v_row.student_id)
  from {{schema}}.assessments a where a.id = v_row.assessment_id;
  return null;
end;
$$;

revoke execute on function {{schema}}.assessment_scores_guard() from authenticated;
revoke execute on function {{schema}}.assessment_scores_recompute() from authenticated;

create trigger assessment_scores_guard
  before insert or update or delete on {{schema}}.assessment_scores
  for each row execute function {{schema}}.assessment_scores_guard();
create trigger assessment_scores_recompute
  after insert or update or delete on {{schema}}.assessment_scores
  for each row execute function {{schema}}.assessment_scores_recompute();

-- Assessments change only while every grade in the offering is a draft; weights
-- total at most 100.
create function {{schema}}.assessments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offering uuid := coalesce(new.offering_id, old.offering_id);
  v_total numeric;
begin
  if (select auth.uid()) is not null
    and not ({{schema}}.teaches_offering(v_offering) or {{schema}}.is_registrar()) then
    raise exception 'You are not assigned to this course' using errcode = '42501';
  end if;
  if exists (select 1 from {{schema}}.final_grades where offering_id = v_offering and status <> 'draft')
    or (tg_op = 'UPDATE' and new.offering_id <> old.offering_id) then
    raise exception 'Grades for this course are submitted; assessments cannot change' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' then
    select coalesce(sum(weight_percent), 0) + new.weight_percent into v_total
    from {{schema}}.assessments where offering_id = new.offering_id and id <> new.id;
    if v_total > 100 then
      raise exception 'Assessment weights add up to % percent; the total cannot exceed 100', v_total
        using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create function {{schema}}.assessments_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform {{schema}}.recompute_final_grade(r.offering_id, r.student_id)
  from {{schema}}.course_registrations r
  where r.offering_id = coalesce(new.offering_id, old.offering_id) and r.status = 'approved';
  return null;
end;
$$;

revoke execute on function {{schema}}.assessments_guard() from authenticated;
revoke execute on function {{schema}}.assessments_recompute() from authenticated;

create trigger assessments_guard
  before insert or update or delete on {{schema}}.assessments
  for each row execute function {{schema}}.assessments_guard();
create trigger assessments_recompute
  after insert or update or delete on {{schema}}.assessments
  for each row execute function {{schema}}.assessments_recompute();

-- Locked grades are read-only; reopening needs a reason (SCH-03).
create function {{schema}}.final_grades_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Final grades are never deleted' using errcode = '23514';
  end if;
  if old.status = 'locked' and new.status <> 'draft' then
    raise exception 'Locked grades cannot be edited; the Registrar must reopen them with a reason'
      using errcode = '23514';
  end if;
  if old.status <> 'draft' and new.status = 'draft'
    and length(trim(coalesce(current_setting('corex.audit_reason', true), ''))) = 0 then
    raise exception 'Reopening grades requires a reason' using errcode = '23514';
  end if;
  if old.status <> 'draft' and new.status = old.status
    and (new.numeric_score, new.letter, new.grade_points) is distinct from (old.numeric_score, old.letter, old.grade_points) then
    raise exception 'Only draft grades can change' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function {{schema}}.final_grades_guard() from authenticated;

create trigger final_grades_guard
  before update or delete on {{schema}}.final_grades
  for each row execute function {{schema}}.final_grades_guard();

-- Instructor (or Registrar) submits an offering's grades once every score is in.
create function {{schema}}.submit_grades(p_offering_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weight numeric;
  v_missing integer;
  v_count integer;
begin
  if not ({{schema}}.teaches_offering(p_offering_id) or {{schema}}.is_registrar()) then
    raise exception 'Only the assigned instructor can submit these grades' using errcode = '42501';
  end if;
  select coalesce(sum(weight_percent), 0) into v_weight from {{schema}}.assessments where offering_id = p_offering_id;
  if v_weight <> 100 then
    raise exception 'Assessment weights add up to % percent; they must total 100 before submitting', v_weight
      using errcode = '23514';
  end if;
  if not exists (select 1 from {{schema}}.grade_scale) then
    raise exception 'The grade scale is not set up yet' using errcode = '23514';
  end if;
  select count(*) into v_missing
  from {{schema}}.course_registrations r
  cross join {{schema}}.assessments a
  left join {{schema}}.assessment_scores s on s.assessment_id = a.id and s.student_id = r.student_id
  where r.offering_id = p_offering_id and r.status = 'approved'
    and a.offering_id = p_offering_id and s.id is null;
  if v_missing > 0 then
    raise exception '% scores are still missing', v_missing using errcode = '23514';
  end if;
  perform {{schema}}.recompute_final_grade(p_offering_id, r.student_id)
  from {{schema}}.course_registrations r where r.offering_id = p_offering_id and r.status = 'approved';
  update {{schema}}.final_grades g set status = 'submitted', submitted_at = now()
  where g.offering_id = p_offering_id and g.status = 'draft'
    and {{schema}}.on_class_list(p_offering_id, g.student_id);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no draft grades to submit' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

-- Registrar approves submitted grades; an instructor never approves their own.
create function {{schema}}.approve_grades(p_offering_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can approve grades' using errcode = '42501';
  end if;
  if exists (select 1 from {{schema}}.course_offerings where id = p_offering_id and instructor_id = (select auth.uid())) then
    raise exception 'You cannot approve grades for a course you teach' using errcode = '42501';
  end if;
  update {{schema}}.final_grades set status = 'approved', approved_by = (select auth.uid()), approved_at = now()
  where offering_id = p_offering_id and status = 'submitted';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no submitted grades to approve' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

-- Registrar locks approved grades; they then show in portals and transcripts.
create function {{schema}}.lock_grades(p_offering_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can lock grades' using errcode = '42501';
  end if;
  update {{schema}}.final_grades set status = 'locked', locked_at = now()
  where offering_id = p_offering_id and status = 'approved';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no approved grades to lock' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

-- Registrar reopens submitted, approved or locked grades (one student or the whole
-- offering) with a mandatory reason, kept in the audit log (SCH-03).
create function {{schema}}.reopen_grades(p_offering_id uuid, p_reason text, p_student_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not {{schema}}.is_registrar() then
    raise exception 'Only the Registrar can reopen grades' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required to reopen grades' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', p_reason, true);
  update {{schema}}.final_grades
  set status = 'draft', submitted_at = null, approved_by = null, approved_at = null, locked_at = null
  where offering_id = p_offering_id and status <> 'draft'
    and (p_student_id is null or student_id = p_student_id);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'There are no grades to reopen' using errcode = '23514';
  end if;
  return v_count;
end;
$$;

grant execute on function {{schema}}.submit_grades(uuid) to authenticated;
grant execute on function {{schema}}.approve_grades(uuid) to authenticated;
grant execute on function {{schema}}.lock_grades(uuid) to authenticated;
grant execute on function {{schema}}.reopen_grades(uuid, text, uuid) to authenticated;

-- Fees: bulk invoices per term (SPEC.md 7.5) ------------------------------------------

-- Creates and issues one invoice per active student and currency from the fee
-- structures for the term (items for the student's program code or 'all'). Students
-- already invoiced for the term in that currency are skipped, so it can be re-run.
create function {{schema}}.generate_term_invoices(p_term_id uuid, p_due_date date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term {{schema}}.terms%rowtype;
  v_target record;
  v_invoice uuid;
  v_count integer := 0;
begin
  if not {{schema}}.can_bill() then
    raise exception 'Only the Bursar can generate fee invoices' using errcode = '42501';
  end if;
  select * into v_term from {{schema}}.terms where id = p_term_id;
  if not found then
    raise exception 'Term not found' using errcode = 'P0002';
  end if;
  for v_target in
    select s.id as student_id, f.currency
    from {{schema}}.students s
    join {{schema}}.program_enrollments e on e.student_id = s.id and e.status = 'active'
    join {{schema}}.programs p on p.id = e.program_id
    join {{schema}}.fee_structures f
      on f.academic_year_id = v_term.academic_year_id
     and (f.term_id is null or f.term_id = p_term_id)
     and (f.applies_to = 'all' or f.applies_to = p.code)
    where s.status = 'active'
      and not exists (
        select 1 from {{schema}}.term_invoices ti
        where ti.term_id = p_term_id and ti.student_id = s.id and ti.currency = f.currency
      )
    group by s.id, f.currency
  loop
    insert into {{schema}}.invoices (party_type, party_id, currency, due_date, notes)
    values ('student', v_target.student_id, v_target.currency, p_due_date, v_term.name || ' fees')
    returning id into v_invoice;
    insert into {{schema}}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor)
    select v_invoice, f.item, 1, f.amount_minor, f.amount_minor
    from {{schema}}.program_enrollments e
    join {{schema}}.programs p on p.id = e.program_id
    join {{schema}}.fee_structures f on true
    where e.student_id = v_target.student_id and e.status = 'active'
      and f.academic_year_id = v_term.academic_year_id
      and (f.term_id is null or f.term_id = p_term_id)
      and (f.applies_to = 'all' or f.applies_to = p.code)
      and f.currency = v_target.currency
    order by f.item;
    perform {{schema}}.issue_invoice(v_invoice);
    insert into {{schema}}.term_invoices (term_id, student_id, currency, invoice_id)
    values (p_term_id, v_target.student_id, v_target.currency, v_invoice);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function {{schema}}.generate_term_invoices(uuid, date) to authenticated;

-- Row-level security ----------------------------------------------------------------

alter table {{schema}}.departments enable row level security;
alter table {{schema}}.programs enable row level security;
alter table {{schema}}.courses enable row level security;
alter table {{schema}}.course_prerequisites enable row level security;
alter table {{schema}}.program_requirements enable row level security;
alter table {{schema}}.program_enrollments enable row level security;
alter table {{schema}}.course_offerings enable row level security;
alter table {{schema}}.course_registrations enable row level security;
alter table {{schema}}.grade_scale enable row level security;
alter table {{schema}}.assessments enable row level security;
alter table {{schema}}.assessment_scores enable row level security;
alter table {{schema}}.final_grades enable row level security;

-- Registrations and final grades change only through the functions above.
revoke insert, update, delete on {{schema}}.course_registrations from authenticated;
revoke insert, update, delete on {{schema}}.final_grades from authenticated;

-- Catalogue: every member reads; the Registrar maintains it.
create policy departments_read on {{schema}}.departments
  for select to authenticated using ((select {{schema}}.is_member()));
create policy departments_write on {{schema}}.departments
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy programs_read on {{schema}}.programs
  for select to authenticated using ((select {{schema}}.is_member()));
create policy programs_write on {{schema}}.programs
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy courses_read on {{schema}}.courses
  for select to authenticated using ((select {{schema}}.is_member()));
create policy courses_write on {{schema}}.courses
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy course_prerequisites_read on {{schema}}.course_prerequisites
  for select to authenticated using ((select {{schema}}.is_member()));
create policy course_prerequisites_write on {{schema}}.course_prerequisites
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy program_requirements_read on {{schema}}.program_requirements
  for select to authenticated using ((select {{schema}}.is_member()));
create policy program_requirements_write on {{schema}}.program_requirements
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy grade_scale_read on {{schema}}.grade_scale
  for select to authenticated using ((select {{schema}}.is_member()));
create policy grade_scale_write on {{schema}}.grade_scale
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));
create policy course_offerings_read on {{schema}}.course_offerings
  for select to authenticated using ((select {{schema}}.is_member()));
create policy course_offerings_write on {{schema}}.course_offerings
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy program_enrollments_office_read on {{schema}}.program_enrollments
  for select to authenticated using ((select {{schema}}.is_school_office()));
create policy program_enrollments_own_read on {{schema}}.program_enrollments
  for select to authenticated using (student_id in (select {{schema}}.my_student_ids()));
create policy program_enrollments_registrar_write on {{schema}}.program_enrollments
  for all to authenticated
  using ((select {{schema}}.is_registrar())) with check ((select {{schema}}.is_registrar()));

create policy course_registrations_registrar_read on {{schema}}.course_registrations
  for select to authenticated using ((select {{schema}}.is_registrar()));
create policy course_registrations_own_read on {{schema}}.course_registrations
  for select to authenticated using (student_id in (select {{schema}}.my_student_ids()));
create policy course_registrations_instructor_read on {{schema}}.course_registrations
  for select to authenticated
  using (status = 'approved' and offering_id in (select {{schema}}.my_offering_ids()));

-- Instructors see the students on their class lists, and only those (SPEC.md 7.1).
create policy students_instructor_read on {{schema}}.students
  for select to authenticated using (id in (select {{schema}}.my_class_student_ids()));

-- Attendance per offering session by the assigned instructor (SCH-02).
create policy attendance_instructor_read on {{schema}}.attendance
  for select to authenticated
  using (class_ref_type = 'offering' and class_ref_id in (select {{schema}}.my_offering_ids()));
create policy attendance_insert on {{schema}}.attendance
  for insert to authenticated
  with check (
    class_ref_type = 'offering'
    and ({{schema}}.teaches_offering(class_ref_id) or (select {{schema}}.is_registrar()))
    and {{schema}}.on_class_list(class_ref_id, student_id)
    and recorded_by = (select auth.uid())
  );

create policy assessments_read on {{schema}}.assessments
  for select to authenticated
  using ((select {{schema}}.is_registrar()) or offering_id in (select {{schema}}.my_offering_ids()));
create policy assessments_write on {{schema}}.assessments
  for all to authenticated
  using ({{schema}}.teaches_offering(offering_id) or (select {{schema}}.is_registrar()))
  with check ({{schema}}.teaches_offering(offering_id) or (select {{schema}}.is_registrar()));

-- Scores: the assigned instructor only (SCH-02); the Registrar reads them.
create policy assessment_scores_read on {{schema}}.assessment_scores
  for select to authenticated
  using (
    (select {{schema}}.is_registrar())
    or assessment_id in (select a.id from {{schema}}.assessments a where a.offering_id in (select {{schema}}.my_offering_ids()))
  );
create policy assessment_scores_instructor_insert on {{schema}}.assessment_scores
  for insert to authenticated
  with check (
    entered_by = (select auth.uid())
    and assessment_id in (select a.id from {{schema}}.assessments a where a.offering_id in (select {{schema}}.my_offering_ids()))
  );
create policy assessment_scores_instructor_update on {{schema}}.assessment_scores
  for update to authenticated
  using (assessment_id in (select a.id from {{schema}}.assessments a where a.offering_id in (select {{schema}}.my_offering_ids())))
  with check (
    entered_by = (select auth.uid())
    and assessment_id in (select a.id from {{schema}}.assessments a where a.offering_id in (select {{schema}}.my_offering_ids()))
  );

-- Final grades: Registrar and the instructor see them; students only locked
-- (published) grades (SPEC.md 7.5).
create policy final_grades_registrar_read on {{schema}}.final_grades
  for select to authenticated using ((select {{schema}}.is_registrar()));
create policy final_grades_instructor_read on {{schema}}.final_grades
  for select to authenticated using (offering_id in (select {{schema}}.my_offering_ids()));
create policy final_grades_own_read on {{schema}}.final_grades
  for select to authenticated
  using (status = 'locked' and student_id in (select {{schema}}.my_student_ids()));

select {{schema}}.enable_audit('{{schema}}.departments');
select {{schema}}.enable_audit('{{schema}}.programs');
select {{schema}}.enable_audit('{{schema}}.courses');
select {{schema}}.enable_audit('{{schema}}.course_prerequisites');
select {{schema}}.enable_audit('{{schema}}.program_requirements');
select {{schema}}.enable_audit('{{schema}}.program_enrollments');
select {{schema}}.enable_audit('{{schema}}.course_offerings');
select {{schema}}.enable_audit('{{schema}}.course_registrations');
select {{schema}}.enable_audit('{{schema}}.grade_scale');
select {{schema}}.enable_audit('{{schema}}.assessments');
select {{schema}}.enable_audit('{{schema}}.assessment_scores');
select {{schema}}.enable_audit('{{schema}}.final_grades');
