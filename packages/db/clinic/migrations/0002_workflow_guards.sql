-- Workflow guards (audit of Phases 6-10). Front desk staff may update appointments and
-- queue entries directly, but only the changes the screens make: a direct API call
-- (current_user = 'authenticated') cannot mark an appointment checked in or completed,
-- move it to another patient, or link a queue entry to a visit. Those steps go through
-- check_in, start_encounter and close_encounter, which run as the function owner.

create function {{schema}}.appointments_direct_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.patient_id <> old.patient_id then
    raise exception 'An appointment cannot move to another patient; book a new one' using errcode = '23514';
  end if;
  if old.status <> 'booked'
    and (new.status <> old.status or new.starts_at <> old.starts_at
         or new.duration_minutes <> old.duration_minutes or new.clinician_id <> old.clinician_id) then
    raise exception 'Only a booked appointment can be changed' using errcode = '23514';
  end if;
  if new.status <> old.status and new.status not in ('cancelled', 'no_show') then
    raise exception 'Check patients in from the appointment; visits complete it' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger appointments_direct_guard before update on {{schema}}.appointments
  for each row execute function {{schema}}.appointments_direct_guard();

create function {{schema}}.queue_direct_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.patient_id <> old.patient_id or new.appointment_id is distinct from old.appointment_id
    or new.encounter_id is distinct from old.encounter_id or new.arrived_at <> old.arrived_at then
    raise exception 'Only the queue status can change here' using errcode = '23514';
  end if;
  if new.status <> old.status
    and (old.encounter_id is not null or old.status = 'done'
         or new.status not in ('waiting', 'with_nurse', 'done')) then
    raise exception 'The clinician opens and closes the visit; the queue follows it' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger queue_direct_guard before update on {{schema}}.queue_entries
  for each row execute function {{schema}}.queue_direct_guard();
