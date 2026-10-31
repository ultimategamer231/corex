-- Corex Admin invoices, payments and receipts (SPEC-ADMIN.md 9; PROGRESS.md Admin A4).
-- Reuses the core billing tables (invoices, invoice_lines, payments, receipts) and
-- replaces their functions for Corex's own billing:
--   * totals: subtotal - discount + tax (INV-01 to INV-04), stored on the invoice and
--     kept by save_invoice_draft();
--   * numbers CX-YY-MM-NNN and RC-YY-MM-NNN (owner decision 2026-10-29), from the
--     month the invoice is sent or the receipt issued, restarting each year (INV-05);
--   * due date: sent date + payment terms, 7 days unless set (owner decision 2026-10-31);
--   * payments by Corex's methods, receipts voided with their payment (PAY-01 to PAY-05),
--     and a paid renewal moving the subscription forward a year (PAY-06).
-- In this schema invoices and lines change only through these functions.

alter table {{schema}}.invoices
  add column kind text not null default 'custom' check (kind in ('milestone', 'renewal', 'custom')),
  add column contract_id uuid references {{schema}}.contracts (id),
  add column milestone_no integer check (milestone_no is null or milestone_no between 1 and 6),
  add column renewal_for date,
  add column display_number text unique,
  add column payment_terms_days integer check (payment_terms_days is null or payment_terms_days between 0 and 365),
  -- percent: discount_value is the percentage (0-100); fixed: minor units.
  add column discount_type text check (discount_type in ('percent', 'fixed')),
  add column discount_value numeric(14, 2),
  add column discount_reason text check (discount_reason is null or length(discount_reason) <= 300),
  add column tax_rate_bp integer not null default 0 check (tax_rate_bp between 0 and 10000),
  add column subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  add column discount_minor bigint not null default 0 check (discount_minor >= 0),
  add column tax_minor bigint not null default 0 check (tax_minor >= 0),
  add column total_minor bigint not null default 0 check (total_minor >= 0),
  add column sent_at timestamptz,
  add column emailed_to text,
  add column void_reason text,
  add column voided_at timestamptz,
  add column renewal_applied boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add constraint invoices_client_party check (party_type = 'client'),
  add constraint invoices_discount_pair check (
    (discount_type is null and discount_value is null)
    or (discount_type = 'percent' and discount_value between 0 and 100)
    or (discount_type = 'fixed' and discount_value >= 0 and discount_value = trunc(discount_value))
  ),
  add constraint invoices_milestone_fields check (
    (kind = 'milestone') = (milestone_no is not null)
    and (kind = 'custom' or contract_id is not null)
    and ((kind = 'renewal') = (renewal_for is not null))
  ),
  add constraint invoices_total_check check (total_minor = subtotal_minor - discount_minor + tax_minor),
  add constraint invoices_void_reason check (status <> 'void' or length(trim(coalesce(void_reason, ''))) > 0);

-- One live invoice per milestone and per renewal period (voided ones can be replaced).
create unique index invoices_one_milestone on {{schema}}.invoices (contract_id, milestone_no)
  where kind = 'milestone' and status <> 'void';
create unique index invoices_one_renewal on {{schema}}.invoices (contract_id, renewal_for)
  where kind = 'renewal' and status <> 'void';
create index invoices_client_idx on {{schema}}.invoices (party_id, created_at desc);

alter table {{schema}}.invoice_lines
  add column details text check (details is null or length(details) <= 500),
  add column position integer not null default 0;

alter table {{schema}}.payments
  drop constraint payments_method_check,
  add constraint payments_method_check
    check (method in ('orange_money', 'mtn_momo', 'bank_transfer', 'wire', 'cash', 'usdt'));

alter table {{schema}}.receipts
  add column display_number text unique,
  add column voided_at timestamptz;

-- Yearly counters for CX-/RC- numbers. Locked per row until commit, so numbers are
-- gapless and never reused.
create table {{schema}}.document_counters (
  kind text not null check (kind in ('invoice', 'receipt')),
  year integer not null check (year between 2000 and 2999),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (kind, year)
);
alter table {{schema}}.document_counters enable row level security;
revoke all on {{schema}}.document_counters from authenticated;

-- Billing settings with their defaults (Settings → Invoicing and payments).
create function {{schema}}.billing_setting(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nullif(s.config ->> p_key, '') from {{schema}}.settings s), p_default);
$$;

revoke execute on function {{schema}}.billing_setting(text, text) from public, anon, authenticated;

create function {{schema}}.today_monrovia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Monrovia')::date;
$$;

grant execute on function {{schema}}.today_monrovia() to authenticated, service_role;

create function {{schema}}.next_display_number(p_kind text, p_on date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_prefix text := case p_kind
    when 'invoice' then {{schema}}.billing_setting('invoice_prefix', 'CX')
    else {{schema}}.billing_setting('receipt_prefix', 'RC')
  end;
begin
  insert into {{schema}}.document_counters (kind, year, last_number)
  values (p_kind, extract(year from p_on)::integer, 1)
  on conflict (kind, year) do update set last_number = {{schema}}.document_counters.last_number + 1
  returning last_number into v_next;
  return v_prefix || '-' || to_char(p_on, 'YY-MM') || '-'
    || case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;
end;
$$;

revoke execute on function {{schema}}.next_display_number(text, date) from public, anon, authenticated;

-- INV-02 to INV-04 in one place (apps/admin/lib/invoices.ts has the same rule; tests
-- check they agree). Percent discounts and tax round half up to the minor unit; the
-- discount never exceeds the subtotal; tax applies after the discount.
create function {{schema}}.invoice_totals(
  p_subtotal_minor bigint,
  p_discount_type text,
  p_discount_value numeric,
  p_tax_rate_bp integer
)
returns table (discount_minor bigint, tax_minor bigint, total_minor bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_discount bigint := case p_discount_type
    when 'percent' then floor(p_subtotal_minor * p_discount_value / 100 + 0.5)::bigint
    when 'fixed' then p_discount_value::bigint
    else 0
  end;
  v_tax bigint;
begin
  if v_discount > p_subtotal_minor then
    raise exception 'The discount cannot be more than the subtotal' using errcode = '23514';
  end if;
  v_tax := floor((p_subtotal_minor - v_discount) * coalesce(p_tax_rate_bp, 0) / 10000.0 + 0.5)::bigint;
  return query select v_discount, v_tax, p_subtotal_minor - v_discount + v_tax;
end;
$$;

grant execute on function {{schema}}.invoice_totals(bigint, text, numeric, integer) to authenticated, service_role;

-- Creates or updates a draft with its lines and totals, in one transaction
-- (SPEC-ADMIN.md 12). `p` holds client_id, kind, contract_id, milestone_no, renewal_for,
-- currency, payment_terms_days, discount_type, discount_value, discount_reason, notes
-- and lines [{description, details, quantity, unit_amount_minor}].
create function {{schema}}.save_invoice_draft(p_invoice_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_invoice_id;
  v_client uuid := (p ->> 'client_id')::uuid;
  v_contract uuid := (p ->> 'contract_id')::uuid;
  v_contract_client uuid;
  v_contract_currency text;
  v_status text;
  v_tax integer;
  v_subtotal bigint;
  v_totals record;
  v_line jsonb;
  v_pos integer := 0;
begin
  perform {{schema}}.require_billing_role();
  if not exists (select 1 from {{schema}}.clients where id = v_client) then
    raise exception 'Choose a client' using errcode = '23514';
  end if;
  if v_contract is not null then
    select client_id, currency into v_contract_client, v_contract_currency
    from {{schema}}.contracts where id = v_contract;
    if v_contract_client is distinct from v_client then
      raise exception 'The contract belongs to another client' using errcode = '23514';
    end if;
    if p ->> 'kind' in ('milestone', 'renewal') and v_contract_currency <> p ->> 'currency' then
      raise exception 'A contract invoice uses the contract''s currency (%)', v_contract_currency
        using errcode = '23514';
    end if;
  end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one line' using errcode = '23514';
  end if;

  if v_id is null then
    v_tax := case when {{schema}}.billing_setting('tax_enabled', 'false') = 'true'
      then {{schema}}.billing_setting('tax_rate_bp', '0')::integer else 0 end;
    insert into {{schema}}.invoices (
      party_type, party_id, currency, status, tax_rate_bp, kind, contract_id, milestone_no, renewal_for
    )
    values (
      'client', v_client, p ->> 'currency', 'draft', v_tax, coalesce(p ->> 'kind', 'custom'),
      v_contract, (p ->> 'milestone_no')::integer, (p ->> 'renewal_for')::date
    )
    returning id into v_id;
  else
    select status into v_status from {{schema}}.invoices where id = v_id for update;
    if not found then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
    if v_status <> 'draft' then
      raise exception 'A sent invoice cannot be changed; void it and create a new one'
        using errcode = '23514';
    end if;
  end if;

  delete from {{schema}}.invoice_lines where invoice_id = v_id;
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_pos := v_pos + 1;
    insert into {{schema}}.invoice_lines (invoice_id, description, details, quantity, unit_amount_minor, amount_minor, position)
    values (
      v_id, v_line ->> 'description', nullif(v_line ->> 'details', ''),
      coalesce((v_line ->> 'quantity')::numeric, 1), (v_line ->> 'unit_amount_minor')::bigint, 0, v_pos
    );
  end loop;
  select coalesce(sum(amount_minor), 0) into v_subtotal from {{schema}}.invoice_lines where invoice_id = v_id;

  select * into v_totals from {{schema}}.invoice_totals(
    v_subtotal, p ->> 'discount_type', (p ->> 'discount_value')::numeric,
    (select tax_rate_bp from {{schema}}.invoices where id = v_id)
  );
  update {{schema}}.invoices set
    party_id = v_client,
    currency = p ->> 'currency',
    kind = coalesce(p ->> 'kind', 'custom'),
    contract_id = v_contract,
    milestone_no = (p ->> 'milestone_no')::integer,
    renewal_for = (p ->> 'renewal_for')::date,
    payment_terms_days = (p ->> 'payment_terms_days')::integer,
    discount_type = p ->> 'discount_type',
    discount_value = (p ->> 'discount_value')::numeric,
    discount_reason = nullif(p ->> 'discount_reason', ''),
    notes = nullif(p ->> 'notes', ''),
    subtotal_minor = v_subtotal,
    discount_minor = v_totals.discount_minor,
    tax_minor = v_totals.tax_minor,
    total_minor = v_totals.total_minor,
    updated_at = now()
  where id = v_id;
  return v_id;
end;
$$;

revoke execute on function {{schema}}.save_invoice_draft(uuid, jsonb) from public, anon;
grant execute on function {{schema}}.save_invoice_draft(uuid, jsonb) to authenticated, service_role;

-- Balances from the stored total (with discount and tax) and posted payments.
create or replace view {{schema}}.invoice_balances
with (security_invoker = true)
as
select
  i.id as invoice_id,
  i.currency,
  i.total_minor,
  coalesce((select sum(p.amount_minor) from {{schema}}.payments p
            where p.invoice_id = i.id and p.status = 'posted'), 0)::bigint
    as paid_minor
from {{schema}}.invoices i;

-- Status from posted payments. A renewal that becomes paid moves its subscription
-- forward a year; if it stops being paid (a voided payment) it moves back (PAY-06).
create or replace function {{schema}}.refresh_invoice_status(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice {{schema}}.invoices%rowtype;
  v_paid bigint;
  v_next text;
begin
  select * into v_invoice from {{schema}}.invoices where id = p_invoice_id;
  if v_invoice.status in ('draft', 'void') then
    return v_invoice.status;
  end if;
  select b.paid_minor into v_paid from {{schema}}.invoice_balances b where b.invoice_id = p_invoice_id;
  v_next := case
    when v_paid = 0 then 'issued'
    when v_paid >= v_invoice.total_minor then 'paid'
    else 'partially_paid'
  end;
  if v_next <> v_invoice.status then
    update {{schema}}.invoices set status = v_next, updated_at = now() where id = p_invoice_id;
  end if;
  if v_invoice.kind = 'renewal' and (v_next = 'paid') <> v_invoice.renewal_applied then
    update {{schema}}.subscriptions
    set next_renewal_on = (next_renewal_on + case when v_next = 'paid' then interval '1 year' else interval '-1 year' end)::date
    where contract_id = v_invoice.contract_id and next_renewal_on is not null;
    update {{schema}}.invoices set renewal_applied = (v_next = 'paid') where id = p_invoice_id;
  end if;
  return v_next;
end;
$$;

revoke execute on function {{schema}}.refresh_invoice_status(uuid) from public, anon, authenticated;

-- Sends a draft (INV-05): its number, sent date and due date are set now.
create or replace function {{schema}}.issue_invoice(p_invoice_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice {{schema}}.invoices%rowtype;
  v_number bigint;
  v_today date := {{schema}}.today_monrovia();
begin
  perform {{schema}}.require_billing_role();
  select * into v_invoice from {{schema}}.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Only a draft invoice can be sent' using errcode = '23514';
  end if;
  if v_invoice.total_minor <= 0 then
    raise exception 'An invoice needs a total above zero' using errcode = '23514';
  end if;
  v_number := {{schema}}.next_document_number('invoice');
  update {{schema}}.invoices
  set number = v_number,
      display_number = {{schema}}.next_display_number('invoice', v_today),
      status = 'issued',
      issue_date = v_today,
      due_date = v_today + coalesce(
        v_invoice.payment_terms_days,
        {{schema}}.billing_setting('payment_terms_days', '7')::integer
      ),
      sent_at = now(),
      updated_at = now()
  where id = p_invoice_id;
  return v_number;
end;
$$;

-- PAY-01 to PAY-03: a payment in the invoice's currency, never more than the balance,
-- with its receipt (RC-YY-MM-NNN) in the same transaction. Idempotent per payment id.
create or replace function {{schema}}.record_payment(
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
    raise exception 'Payments can only be recorded on a sent, unpaid invoice' using errcode = '23514';
  end if;
  if p_currency <> v_invoice.currency then
    raise exception 'The payment must be in the invoice''s currency (%)', v_invoice.currency
      using errcode = '23514';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'The payment must be more than zero' using errcode = '23514';
  end if;
  select b.total_minor - b.paid_minor into v_balance
  from {{schema}}.invoice_balances b where b.invoice_id = p_invoice_id;
  if p_amount_minor > v_balance then
    raise exception 'The payment is more than the balance due' using errcode = '23514';
  end if;

  insert into {{schema}}.payments (id, invoice_id, amount_minor, currency, method, reference, received_at, received_by)
  values (p_payment_id, p_invoice_id, p_amount_minor, p_currency, p_method, nullif(trim(p_reference), ''),
          coalesce(p_received_at, now()), (select auth.uid()));

  v_receipt_number := {{schema}}.next_document_number('receipt');
  insert into {{schema}}.receipts (payment_id, number, display_number)
  values (p_payment_id, v_receipt_number, {{schema}}.next_display_number('receipt', {{schema}}.today_monrovia()))
  returning id into v_receipt_id;

  v_status := {{schema}}.refresh_invoice_status(p_invoice_id);
  return query select p_payment_id, v_receipt_id, v_receipt_number, v_status;
end;
$$;

-- PAY-05: a voided payment keeps its row; its receipt is voided with it and the
-- invoice's balance and status are recalculated.
create or replace function {{schema}}.void_payment(p_payment_id uuid, p_reason text)
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
    raise exception 'Say why this payment is voided' using errcode = '23514';
  end if;
  select * into v_payment from {{schema}}.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  perform 1 from {{schema}}.invoices where id = v_payment.invoice_id for update;
  if v_payment.status = 'void' then
    raise exception 'This payment is already void' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', trim(p_reason), true);
  update {{schema}}.payments set status = 'void', void_reason = trim(p_reason) where id = p_payment_id;
  update {{schema}}.receipts set voided_at = now() where payment_id = p_payment_id;
  return {{schema}}.refresh_invoice_status(v_payment.invoice_id);
end;
$$;

-- INV-06: a sent invoice is voided with a reason (payments first) and stays visible.
create or replace function {{schema}}.void_invoice(p_invoice_id uuid, p_reason text)
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
    raise exception 'Say why this invoice is voided' using errcode = '23514';
  end if;
  select status into v_status from {{schema}}.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_status = 'void' then
    raise exception 'This invoice is already void' using errcode = '23514';
  end if;
  if exists (select 1 from {{schema}}.payments where invoice_id = p_invoice_id and status = 'posted') then
    raise exception 'Void the invoice''s payments first' using errcode = '23514';
  end if;
  perform set_config('corex.audit_reason', trim(p_reason), true);
  update {{schema}}.invoices
  set status = 'void', void_reason = trim(p_reason), voided_at = now(), updated_at = now()
  where id = p_invoice_id;
end;
$$;

-- As the core guard, except that a draft (no number yet) can be deleted.
create or replace function {{schema}}.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'draft' and old.number is null then
      return old;
    end if;
    raise exception 'Sent invoices are never deleted; void them instead' using errcode = '23514';
  end if;
  if old.status <> 'draft'
    and (new.number is distinct from old.number
      or new.display_number is distinct from old.display_number
      or new.party_type is distinct from old.party_type
      or new.party_id is distinct from old.party_id
      or new.currency is distinct from old.currency
      or new.total_minor is distinct from old.total_minor) then
    raise exception 'A sent invoice cannot change its number, client, currency or total' using errcode = '23514';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'A void invoice cannot be reopened' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A draft that is not wanted can be deleted with its lines; anything sent is voided.
create function {{schema}}.delete_invoice_draft(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform {{schema}}.require_billing_role();
  if not exists (select 1 from {{schema}}.invoices where id = p_invoice_id and status = 'draft') then
    raise exception 'Only a draft can be deleted' using errcode = '23514';
  end if;
  delete from {{schema}}.invoice_lines where invoice_id = p_invoice_id;
  delete from {{schema}}.invoices where id = p_invoice_id;
end;
$$;

revoke execute on function {{schema}}.delete_invoice_draft(uuid) from public, anon;
grant execute on function {{schema}}.delete_invoice_draft(uuid) to authenticated, service_role;

-- Every write goes through the functions above.
revoke insert, update, delete on {{schema}}.invoices, {{schema}}.invoice_lines from authenticated;
