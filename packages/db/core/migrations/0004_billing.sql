-- Shared billing: school fees, clinic bills, finance sales invoices (SPEC.md 5.1-5.2).
-- Money changes only through the functions below, which check the caller's role,
-- lock the invoice row and keep totals consistent:
--   issue_invoice, record_payment, void_payment, void_invoice.
-- Draft invoices and their lines are edited directly (row-level security).

-- Roles that may bill. Products replace this function with their own roles
-- (school: bursar; clinic: cashier; finance: accountant), keeping the admin roles.
create function {{schema}}.billing_roles()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['super_admin', 'admin', 'owner'];
$$;

create function {{schema}}.can_bill()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role({{schema}}.billing_roles());
$$;

grant execute on function {{schema}}.billing_roles() to authenticated, service_role;
grant execute on function {{schema}}.can_bill() to authenticated, service_role;

-- Gapless document numbers per schema (CORE-08). The counter row is locked for the
-- rest of the transaction, so concurrent issues queue and a rolled-back issue does
-- not leave a gap. Numbers are never reused: voiding keeps the number.
create table {{schema}}.document_sequences (
  kind text primary key check (kind in ('invoice', 'receipt')),
  last_number bigint not null default 0 check (last_number >= 0)
);
alter table {{schema}}.document_sequences enable row level security;
revoke all on {{schema}}.document_sequences from authenticated;
insert into {{schema}}.document_sequences (kind) values ('invoice'), ('receipt');

create function {{schema}}.next_document_number(p_kind text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update {{schema}}.document_sequences
  set last_number = last_number + 1
  where kind = p_kind
  returning last_number;
$$;

revoke execute on function {{schema}}.next_document_number(text) from authenticated;

-- Line amount = quantity x unit amount, rounded half away from zero to the minor
-- unit (D16). Lines can change only while their invoice is a draft (CORE-07).
create function {{schema}}.invoice_lines_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from {{schema}}.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is distinct from 'draft' then
    raise exception 'Invoice lines can only change while the invoice is a draft' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.amount_minor := round(new.quantity * new.unit_amount_minor)::bigint;
  return new;
end;
$$;

create trigger invoice_lines_guard
  before insert or update or delete on {{schema}}.invoice_lines
  for each row execute function {{schema}}.invoice_lines_guard();

-- Issued invoices keep their number, party and currency; status changes go through
-- the billing functions (CORE-07, CORE-08).
create function {{schema}}.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices are never deleted; void them instead' using errcode = '23514';
  end if;
  if old.status <> 'draft'
    and (new.number is distinct from old.number
      or new.party_type is distinct from old.party_type
      or new.party_id is distinct from old.party_id
      or new.currency is distinct from old.currency) then
    raise exception 'An issued invoice cannot change its number, party or currency' using errcode = '23514';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'A void invoice cannot be reopened' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoices_guard
  before update or delete on {{schema}}.invoices
  for each row execute function {{schema}}.invoices_guard();

-- Posted payments and receipts are never deleted (CORE-07).
create function {{schema}}.never_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are never deleted; void them instead', tg_table_name using errcode = '23514';
end;
$$;

create trigger payments_never_delete before delete on {{schema}}.payments
  for each row execute function {{schema}}.never_delete();
create trigger receipts_never_delete before delete on {{schema}}.receipts
  for each row execute function {{schema}}.never_delete();

-- Totals per invoice, in the invoice's own currency (CORE-05). security_invoker:
-- callers see only invoices row-level security lets them see.
create view {{schema}}.invoice_balances
with (security_invoker = true)
as
select
  i.id as invoice_id,
  i.currency,
  coalesce((select sum(l.amount_minor) from {{schema}}.invoice_lines l where l.invoice_id = i.id), 0)::bigint
    as total_minor,
  coalesce((select sum(p.amount_minor) from {{schema}}.payments p
            where p.invoice_id = i.id and p.status = 'posted'), 0)::bigint
    as paid_minor
from {{schema}}.invoices i;

grant select on {{schema}}.invoice_balances to authenticated;

-- Sets issued / partially_paid / paid from posted payments. Internal.
create function {{schema}}.refresh_invoice_status(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_total bigint;
  v_paid bigint;
  v_next text;
begin
  select i.status, b.total_minor, b.paid_minor into v_status, v_total, v_paid
  from {{schema}}.invoices i
  join {{schema}}.invoice_balances b on b.invoice_id = i.id
  where i.id = p_invoice_id;
  if v_status in ('draft', 'void') then
    return v_status;
  end if;
  v_next := case
    when v_paid = 0 then 'issued'
    when v_paid >= v_total then 'paid'
    else 'partially_paid'
  end;
  if v_next <> v_status then
    update {{schema}}.invoices set status = v_next where id = p_invoice_id;
  end if;
  return v_next;
end;
$$;

revoke execute on function {{schema}}.refresh_invoice_status(uuid) from authenticated;

create function {{schema}}.require_billing_role()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not {{schema}}.can_bill() then
    raise exception 'Your role cannot record billing' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function {{schema}}.require_billing_role() from authenticated;

-- Issues a draft invoice: assigns the next invoice number and the issue date.
create function {{schema}}.issue_invoice(p_invoice_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice {{schema}}.invoices%rowtype;
  v_number bigint;
  v_today date;
begin
  perform {{schema}}.require_billing_role();
  select * into v_invoice from {{schema}}.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Only a draft invoice can be issued' using errcode = '23514';
  end if;
  if not exists (select 1 from {{schema}}.invoice_lines where invoice_id = p_invoice_id) then
    raise exception 'An invoice needs at least one line' using errcode = '23514';
  end if;
  select (now() at time zone s.timezone)::date into v_today from {{schema}}.settings s;
  v_number := {{schema}}.next_document_number('invoice');
  update {{schema}}.invoices
  set number = v_number,
      status = 'issued',
      issue_date = coalesce(issue_date, v_today, current_date)
  where id = p_invoice_id;
  return v_number;
end;
$$;

-- Records a payment and issues its receipt. Idempotent (CORE-06): retrying with the
-- same payment id returns the original payment and receipt without a second record.
create function {{schema}}.record_payment(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_method text,
  p_reference text default null,
  p_received_at timestamptz default null
)
returns table (payment_id uuid, receipt_id uuid, receipt_number bigint, invoice_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice {{schema}}.invoices%rowtype;
  v_existing {{schema}}.payments%rowtype;
  v_balance bigint;
  v_receipt_id uuid;
  v_receipt_number bigint;
  v_status text;
begin
  perform {{schema}}.require_billing_role();

  select * into v_existing from {{schema}}.payments where id = p_payment_id;
  if found then
    if v_existing.invoice_id <> p_invoice_id or v_existing.amount_minor <> p_amount_minor
      or v_existing.currency <> p_currency then
      raise exception 'Payment id already used for a different payment' using errcode = '23505';
    end if;
    select r.id, r.number into v_receipt_id, v_receipt_number
    from {{schema}}.receipts r where r.payment_id = p_payment_id;
    select i.status into v_status from {{schema}}.invoices i where i.id = p_invoice_id;
    return query select p_payment_id, v_receipt_id, v_receipt_number, v_status;
    return;
  end if;

  select * into v_invoice from {{schema}}.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_invoice.status not in ('issued', 'partially_paid') then
    raise exception 'Payments can only be recorded on an issued, unpaid invoice' using errcode = '23514';
  end if;
  -- Never mix currencies without a saved exchange rate (CORE-05).
  if p_currency <> v_invoice.currency then
    raise exception 'Payment currency % does not match invoice currency %', p_currency, v_invoice.currency
      using errcode = '23514';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '23514';
  end if;
  select b.total_minor - b.paid_minor into v_balance
  from {{schema}}.invoice_balances b where b.invoice_id = p_invoice_id;
  if p_amount_minor > v_balance then
    raise exception 'Payment is more than the balance due (%)', v_balance using errcode = '23514';
  end if;

  insert into {{schema}}.payments (id, invoice_id, amount_minor, currency, method, reference, received_at, received_by)
  values (p_payment_id, p_invoice_id, p_amount_minor, p_currency, p_method, p_reference,
          coalesce(p_received_at, now()), (select auth.uid()));

  v_receipt_number := {{schema}}.next_document_number('receipt');
  insert into {{schema}}.receipts (payment_id, number)
  values (p_payment_id, v_receipt_number)
  returning id into v_receipt_id;

  v_status := {{schema}}.refresh_invoice_status(p_invoice_id);
  return query select p_payment_id, v_receipt_id, v_receipt_number, v_status;
end;
$$;

-- Voids a posted payment with a reason (CORE-07). The payment and its receipt stay
-- visible; the invoice balance goes back up.
create function {{schema}}.void_payment(p_payment_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment {{schema}}.payments%rowtype;
begin
  perform {{schema}}.require_billing_role();
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required to void a payment' using errcode = '23514';
  end if;
  select * into v_payment from {{schema}}.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  perform 1 from {{schema}}.invoices where id = v_payment.invoice_id for update;
  if v_payment.status = 'void' then
    raise exception 'Payment is already void' using errcode = '23514';
  end if;
  update {{schema}}.payments set status = 'void', void_reason = trim(p_reason) where id = p_payment_id;
  return {{schema}}.refresh_invoice_status(v_payment.invoice_id);
end;
$$;

-- Voids an invoice with a reason. Payments must be voided first, so money is never
-- silently dropped.
create function {{schema}}.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform {{schema}}.require_billing_role();
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required to void an invoice' using errcode = '23514';
  end if;
  select status into v_status from {{schema}}.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_status = 'void' then
    raise exception 'Invoice is already void' using errcode = '23514';
  end if;
  if exists (select 1 from {{schema}}.payments where invoice_id = p_invoice_id and status = 'posted') then
    raise exception 'Void the invoice''s payments first' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', trim(p_reason), true);
  update {{schema}}.invoices set status = 'void' where id = p_invoice_id;
end;
$$;

grant execute on function {{schema}}.issue_invoice(uuid) to authenticated;
grant execute on function {{schema}}.record_payment(uuid, uuid, bigint, text, text, text, timestamptz) to authenticated;
grant execute on function {{schema}}.void_payment(uuid, text) to authenticated;
grant execute on function {{schema}}.void_invoice(uuid, text) to authenticated;

-- Billing roles read all billing records and edit draft invoices and their lines.
create policy invoices_billing_read on {{schema}}.invoices
  for select to authenticated using ((select {{schema}}.can_bill()));
create policy invoices_billing_insert on {{schema}}.invoices
  for insert to authenticated
  with check ((select {{schema}}.can_bill()) and status = 'draft' and number is null);
create policy invoices_billing_update_draft on {{schema}}.invoices
  for update to authenticated
  using ((select {{schema}}.can_bill()) and status = 'draft')
  with check ((select {{schema}}.can_bill()) and status = 'draft' and number is null);

create policy invoice_lines_billing_read on {{schema}}.invoice_lines
  for select to authenticated using ((select {{schema}}.can_bill()));
create policy invoice_lines_billing_insert on {{schema}}.invoice_lines
  for insert to authenticated with check ((select {{schema}}.can_bill()));
create policy invoice_lines_billing_update on {{schema}}.invoice_lines
  for update to authenticated
  using ((select {{schema}}.can_bill())) with check ((select {{schema}}.can_bill()));
create policy invoice_lines_billing_delete on {{schema}}.invoice_lines
  for delete to authenticated using ((select {{schema}}.can_bill()));

create policy payments_billing_read on {{schema}}.payments
  for select to authenticated using ((select {{schema}}.can_bill()));
create policy receipts_billing_read on {{schema}}.receipts
  for select to authenticated using ((select {{schema}}.can_bill()));

-- Payments and receipts are written only by the functions above.
revoke insert, update, delete on {{schema}}.payments from authenticated;
revoke insert, update, delete on {{schema}}.receipts from authenticated;

-- Sign-in history (audit action 'login'), called by the app after each sign-in.
create function {{schema}}.log_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not {{schema}}.is_member() then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  insert into {{schema}}.audit_events (actor_id, action, table_name, record_id)
  values ((select auth.uid()), 'login', 'memberships', (select auth.uid())::text);
end;
$$;

grant execute on function {{schema}}.log_login() to authenticated;
