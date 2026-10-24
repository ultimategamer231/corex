-- Financial Management (SPEC.md 9): cash accounts, income and expense entries,
-- transfers, sales invoices on the shared billing tables, payroll.
-- Roles: owner and admin (everything), accountant (transactions, invoices, payroll
-- preparation, reports), staff (records income and expense entries only).
-- Money moves only through the functions below; tables are read through
-- row-level security and are never edited or deleted directly.

-- Roles -------------------------------------------------------------------------

-- Sales invoices are handled by the accountant; administrators keep access.
create or replace function {{schema}}.billing_roles()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['super_admin', 'admin', 'owner', 'accountant'];
$$;

-- Owner / Admin: approvals, payroll payment, settings.
create function {{schema}}.is_finance_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['owner', 'admin']);
$$;

-- Owner, Admin or Accountant: everything except users and payroll approval.
create function {{schema}}.is_finance_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select {{schema}}.has_role(array['owner', 'admin', 'accountant']);
$$;

grant execute on function {{schema}}.is_finance_owner() to authenticated, service_role;
grant execute on function {{schema}}.is_finance_manager() to authenticated, service_role;

-- Reference data ------------------------------------------------------------------

create table {{schema}}.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  type text not null check (type in ('cash', 'bank', 'mobile_money')),
  currency text not null check (currency in ('USD', 'LRD')),
  opening_balance_minor bigint not null default 0,
  opened_on date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table {{schema}}.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('income', 'expense')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, type)
);

create table {{schema}}.counterparties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('customer', 'vendor', 'both')),
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- Reference rates that prefill entry; each transaction keeps the rate it was saved
-- with, which is what reports use (FIN-03). 1 from_currency = rate to_currency.
create table {{schema}}.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  from_currency text not null check (from_currency in ('USD', 'LRD')),
  to_currency text not null check (to_currency in ('USD', 'LRD')),
  rate numeric(18, 6) not null check (rate > 0),
  created_at timestamptz not null default now(),
  unique (date, from_currency, to_currency),
  check (from_currency <> to_currency)
);

-- Transactions --------------------------------------------------------------------

create table {{schema}}.transactions (
  -- Made by the device, so a retried submission is recognized (FIN-02).
  id uuid primary key,
  type text not null check (type in ('income', 'expense', 'transfer')),
  date date not null,
  account_id uuid not null references {{schema}}.accounts (id),
  to_account_id uuid references {{schema}}.accounts (id),
  category_id uuid references {{schema}}.categories (id),
  counterparty_id uuid references {{schema}}.counterparties (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'LRD')),
  fx_rate_to_base numeric(18, 6) not null check (fx_rate_to_base > 0),
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  memo text,
  receipt_file_id uuid references {{schema}}.files (id),
  status text not null default 'posted' check (status in ('posted', 'void')),
  void_reason text,
  reversal_of_id uuid unique references {{schema}}.transactions (id),
  invoice_payment_id uuid references {{schema}}.payments (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((type = 'transfer') = (to_account_id is not null)),
  check (to_account_id is distinct from account_id),
  check (type = 'transfer' or category_id is not null),
  check (status <> 'void' or length(trim(coalesce(void_reason, ''))) > 0)
);

create index transactions_date_idx on {{schema}}.transactions (date);
create index transactions_account_idx on {{schema}}.transactions (account_id);
create unique index transactions_invoice_payment_idx on {{schema}}.transactions (invoice_payment_id)
  where reversal_of_id is null;

-- Entries are immutable: only `status` and `void_reason` change, and only through
-- void_transaction. Nothing is deleted (FIN-05).
create function {{schema}}.transactions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Transactions are never deleted; void them instead' using errcode = '23514';
  end if;
  if coalesce(current_setting('corex.finance_void', true), '') <> 'on'
    or (to_jsonb(new) - 'status' - 'void_reason') <> (to_jsonb(old) - 'status' - 'void_reason') then
    raise exception 'Posted transactions cannot be edited; void them instead' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_guard before update or delete on {{schema}}.transactions
  for each row execute function {{schema}}.transactions_guard();

-- One signed line per account touched (a transfer touches two). Every entry counts,
-- and a void adds an equal opposite reversal, so voided entries net to zero while
-- staying visible (FIN-05). Balances and reports read this view.
create view {{schema}}.ledger
with (security_invoker = true)
as
select
  t.id as transaction_id,
  t.date,
  t.type,
  t.account_id,
  t.category_id,
  t.counterparty_id,
  t.currency,
  (case when t.type = 'income' then 1 else -1 end)
    * (case when t.reversal_of_id is null then 1 else -1 end) * t.amount_minor as amount_minor,
  (case when t.type = 'income' then 1 else -1 end)
    * (case when t.reversal_of_id is null then 1 else -1 end) * t.base_amount_minor as base_amount_minor,
  t.reversal_of_id is not null as is_reversal
from {{schema}}.transactions t
union all
select
  t.id,
  t.date,
  t.type,
  t.to_account_id,
  null,
  t.counterparty_id,
  t.currency,
  (case when t.reversal_of_id is null then 1 else -1 end) * t.amount_minor,
  (case when t.reversal_of_id is null then 1 else -1 end) * t.base_amount_minor,
  t.reversal_of_id is not null
from {{schema}}.transactions t
where t.type = 'transfer';

grant select on {{schema}}.ledger to authenticated;

-- Opening balance plus every entry, in the account's currency (computed, never stored).
create view {{schema}}.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.currency,
  a.opening_balance_minor
    + coalesce((select sum(l.amount_minor) from {{schema}}.ledger l where l.account_id = a.id), 0)::bigint
    as balance_minor
from {{schema}}.accounts a;

grant select on {{schema}}.account_balances to authenticated;

-- Rate to the base currency: 1 for the base currency, else the rate given, else the
-- latest reference rate on or before the date. Internal.
create function {{schema}}.rate_to_base(p_currency text, p_date date, p_rate numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_rate numeric;
begin
  select base_currency into v_base from {{schema}}.settings;
  if p_currency = coalesce(v_base, 'USD') then
    return 1;
  end if;
  if p_rate is not null then
    if p_rate <= 0 then
      raise exception 'The exchange rate must be greater than zero' using errcode = '23514';
    end if;
    return p_rate;
  end if;
  select r.rate into v_rate
  from {{schema}}.exchange_rates r
  where r.from_currency = p_currency and r.to_currency = v_base and r.date <= p_date
  order by r.date desc
  limit 1;
  if v_rate is null then
    select 1 / r.rate into v_rate
    from {{schema}}.exchange_rates r
    where r.from_currency = v_base and r.to_currency = p_currency and r.date <= p_date
    order by r.date desc
    limit 1;
  end if;
  if v_rate is null then
    raise exception 'Enter the exchange rate from % to %', p_currency, v_base using errcode = '23514';
  end if;
  return round(v_rate, 6);
end;
$$;

revoke execute on function {{schema}}.rate_to_base(text, date, numeric) from authenticated;

-- Records an income, expense or transfer (FIN-01). Idempotent (FIN-02): the same id
-- with the same details returns the saved entry; with different details it fails.
-- The rate and base amount are saved once and never recalculated (FIN-03).
create function {{schema}}.record_transaction(
  p_id uuid,
  p_type text,
  p_date date,
  p_account_id uuid,
  p_amount_minor bigint,
  p_category_id uuid default null,
  p_to_account_id uuid default null,
  p_counterparty_id uuid default null,
  p_fx_rate numeric default null,
  p_memo text default null,
  p_receipt_file_id uuid default null
)
returns {{schema}}.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing {{schema}}.transactions%rowtype;
  v_account {{schema}}.accounts%rowtype;
  v_to {{schema}}.accounts%rowtype;
  v_category {{schema}}.categories%rowtype;
  v_rate numeric;
  v_row {{schema}}.transactions%rowtype;
begin
  if (select auth.uid()) is not null then
    if not {{schema}}.has_role(array['owner', 'admin', 'accountant', 'staff']) then
      raise exception 'Your role cannot record transactions' using errcode = '42501';
    end if;
    if p_type = 'transfer' and not {{schema}}.is_finance_manager() then
      raise exception 'Only the Owner or Accountant can record transfers' using errcode = '42501';
    end if;
  end if;

  select * into v_existing from {{schema}}.transactions where id = p_id;
  if found then
    if v_existing.type <> p_type or v_existing.date <> p_date or v_existing.account_id <> p_account_id
      or v_existing.amount_minor <> p_amount_minor
      or v_existing.category_id is distinct from p_category_id
      or v_existing.to_account_id is distinct from p_to_account_id then
      raise exception 'Transaction id already used for a different entry' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  if p_type not in ('income', 'expense', 'transfer') then
    raise exception 'Choose income, expense or transfer' using errcode = '23514';
  end if;
  if p_date is null then
    raise exception 'Enter the date' using errcode = '23514';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'The amount must be greater than zero' using errcode = '23514';
  end if;
  select * into v_account from {{schema}}.accounts where id = p_account_id;
  if not found then
    raise exception 'Choose an account' using errcode = '23514';
  end if;
  if not v_account.active then
    raise exception 'The account % is closed', v_account.name using errcode = '23514';
  end if;

  if p_type = 'transfer' then
    select * into v_to from {{schema}}.accounts where id = p_to_account_id;
    if not found or p_to_account_id = p_account_id then
      raise exception 'Choose a different account to transfer to' using errcode = '23514';
    end if;
    if not v_to.active then
      raise exception 'The account % is closed', v_to.name using errcode = '23514';
    end if;
    -- Cross-currency transfers wait for a rule on the rate (PROGRESS.md D36).
    if v_to.currency <> v_account.currency then
      raise exception 'Transfers are between accounts in the same currency' using errcode = '23514';
    end if;
    if p_category_id is not null then
      raise exception 'A transfer has no category' using errcode = '23514';
    end if;
  else
    if p_to_account_id is not null then
      raise exception 'Only a transfer has a second account' using errcode = '23514';
    end if;
    select * into v_category from {{schema}}.categories where id = p_category_id;
    if not found then
      raise exception 'Choose a category' using errcode = '23514';
    end if;
    if v_category.type <> p_type then
      raise exception 'Choose an % category', p_type using errcode = '23514';
    end if;
  end if;

  v_rate := {{schema}}.rate_to_base(v_account.currency, p_date, p_fx_rate);
  insert into {{schema}}.transactions (
    id, type, date, account_id, to_account_id, category_id, counterparty_id, amount_minor,
    currency, fx_rate_to_base, base_amount_minor, memo, receipt_file_id
  ) values (
    p_id, p_type, p_date, p_account_id, p_to_account_id, p_category_id, p_counterparty_id,
    p_amount_minor, v_account.currency, v_rate, round(p_amount_minor * v_rate)::bigint,
    nullif(trim(coalesce(p_memo, '')), ''), p_receipt_file_id
  ) returning * into v_row;
  return v_row;
end;
$$;

grant execute on function {{schema}}.record_transaction(uuid, text, date, uuid, bigint, uuid, uuid, uuid, numeric, text, uuid)
  to authenticated, service_role;

-- Internal: marks an entry void and adds its reversal (same date, amounts and rate).
create function {{schema}}.reverse_transaction(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row {{schema}}.transactions%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required to void a transaction' using errcode = '23514';
  end if;
  select * into v_row from {{schema}}.transactions where id = p_id for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_row.reversal_of_id is not null then
    raise exception 'A reversal cannot be voided' using errcode = '23514';
  end if;
  if v_row.status = 'void' then
    raise exception 'Transaction is already void' using errcode = '23514';
  end if;
  perform set_config('corex.finance_void', 'on', true);
  perform set_config('corex.audit_reason', trim(p_reason), true);
  update {{schema}}.transactions set status = 'void', void_reason = trim(p_reason) where id = p_id;
  perform set_config('corex.finance_void', '', true);
  insert into {{schema}}.transactions (
    id, type, date, account_id, to_account_id, category_id, counterparty_id, amount_minor,
    currency, fx_rate_to_base, base_amount_minor, memo, status, void_reason, reversal_of_id,
    invoice_payment_id
  ) values (
    gen_random_uuid(), v_row.type, v_row.date, v_row.account_id, v_row.to_account_id,
    v_row.category_id, v_row.counterparty_id, v_row.amount_minor, v_row.currency,
    v_row.fx_rate_to_base, v_row.base_amount_minor, 'Reversal: ' || trim(p_reason), 'void',
    trim(p_reason), v_row.id, v_row.invoice_payment_id
  );
end;
$$;

revoke execute on function {{schema}}.reverse_transaction(uuid, text) from authenticated;

-- Voids an entry with a reason (FIN-05). Owner and Accountant only; invoice payments
-- are voided from the invoice so the invoice balance follows.
create function {{schema}}.void_transaction(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not {{schema}}.is_finance_manager() then
    raise exception 'Only the Owner or Accountant can void transactions' using errcode = '42501';
  end if;
  if exists (select 1 from {{schema}}.transactions where id = p_id and invoice_payment_id is not null) then
    raise exception 'This entry is an invoice payment; void the payment on its invoice' using errcode = '23514';
  end if;
  perform {{schema}}.reverse_transaction(p_id, p_reason);
end;
$$;

grant execute on function {{schema}}.void_transaction(uuid, text) to authenticated;

-- Sales invoices --------------------------------------------------------------------

-- Finance invoices are addressed to a counterparty.
create function {{schema}}.invoices_counterparty_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.party_type <> 'counterparty'
    or not exists (select 1 from {{schema}}.counterparties c where c.id = new.party_id) then
    raise exception 'Choose a customer for the invoice' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoices_counterparty_check before insert on {{schema}}.invoices
  for each row execute function {{schema}}.invoices_counterparty_check();

-- Records a payment on an invoice and the matching income entry in the account it
-- was paid into (SPEC.md 9.2). Idempotent on the payment id, which is also the
-- income entry's id.
create function {{schema}}.record_invoice_payment(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_method text,
  p_account_id uuid,
  p_category_id uuid,
  p_date date,
  p_reference text default null,
  p_fx_rate numeric default null
)
returns table (payment_id uuid, receipt_id uuid, receipt_number bigint, invoice_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice {{schema}}.invoices%rowtype;
  v_account {{schema}}.accounts%rowtype;
  v_category {{schema}}.categories%rowtype;
  v_rate numeric;
begin
  perform {{schema}}.require_billing_role();
  select * into v_invoice from {{schema}}.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  select * into v_account from {{schema}}.accounts where id = p_account_id;
  if not found or not v_account.active then
    raise exception 'Choose an open account' using errcode = '23514';
  end if;
  if v_account.currency <> v_invoice.currency then
    raise exception 'Pay a % invoice into a % account', v_invoice.currency, v_invoice.currency
      using errcode = '23514';
  end if;
  select * into v_category from {{schema}}.categories where id = p_category_id;
  if not found or v_category.type <> 'income' then
    raise exception 'Choose an income category' using errcode = '23514';
  end if;

  return query
  select * from {{schema}}.record_payment(
    p_payment_id, p_invoice_id, p_amount_minor, v_invoice.currency, p_method, p_reference,
    (coalesce(p_date, current_date)::timestamp + interval '12 hours') at time zone 'UTC'
  );

  if not exists (select 1 from {{schema}}.transactions where id = p_payment_id) then
    v_rate := {{schema}}.rate_to_base(v_account.currency, coalesce(p_date, current_date), p_fx_rate);
    insert into {{schema}}.transactions (
      id, type, date, account_id, category_id, counterparty_id, amount_minor, currency,
      fx_rate_to_base, base_amount_minor, memo, invoice_payment_id
    ) values (
      p_payment_id, 'income', coalesce(p_date, current_date), p_account_id, p_category_id,
      v_invoice.party_id, p_amount_minor, v_invoice.currency, v_rate,
      round(p_amount_minor * v_rate)::bigint, 'Invoice ' || v_invoice.number, p_payment_id
    );
  end if;
end;
$$;

grant execute on function {{schema}}.record_invoice_payment(uuid, uuid, bigint, text, uuid, uuid, date, text, numeric)
  to authenticated;

-- Voids an invoice payment and reverses its income entry.
create function {{schema}}.void_invoice_payment(p_payment_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  v_status := {{schema}}.void_payment(p_payment_id, p_reason);
  if exists (select 1 from {{schema}}.transactions where id = p_payment_id and status = 'posted') then
    perform {{schema}}.reverse_transaction(p_payment_id, p_reason);
  end if;
  return v_status;
end;
$$;

grant execute on function {{schema}}.void_invoice_payment(uuid, text) to authenticated;

-- The shared payment function would leave the income entry out; use the ones above.
revoke execute on function {{schema}}.record_payment(uuid, uuid, bigint, text, text, text, timestamptz) from authenticated;
revoke execute on function {{schema}}.void_payment(uuid, text) from authenticated;

-- Payroll ---------------------------------------------------------------------------

create table {{schema}}.employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  employee_number text not null unique check (length(trim(employee_number)) > 0),
  position text,
  department text,
  start_date date not null,
  base_salary_minor bigint not null check (base_salary_minor >= 0),
  currency text not null check (currency in ('USD', 'LRD')),
  payment_method text not null default 'bank' check (payment_method in ('cash', 'bank', 'mobile_money')),
  bank_or_wallet_ref text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- No tax or social security rate is built in (FIN-06): each client adds its own.
-- `default_value` is minor units for `fixed`, a percentage for `percent_of_base`.
create table {{schema}}.pay_components (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  kind text not null check (kind in ('allowance', 'deduction')),
  calc text not null check (calc in ('fixed', 'percent_of_base')),
  default_value numeric(14, 4) not null default 0 check (default_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (calc <> 'percent_of_base' or default_value <= 100)
);

-- A component applies to an employee when assigned here; `value` overrides the default.
create table {{schema}}.employee_components (
  employee_id uuid not null references {{schema}}.employees (id),
  pay_component_id uuid not null references {{schema}}.pay_components (id),
  value numeric(14, 4) check (value >= 0),
  primary key (employee_id, pay_component_id)
);

create table {{schema}}.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique check (extract(day from period_month) = 1),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  prepared_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table {{schema}}.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references {{schema}}.payroll_runs (id),
  employee_id uuid not null references {{schema}}.employees (id),
  gross_minor bigint not null,
  total_allowances_minor bigint not null,
  total_deductions_minor bigint not null,
  net_minor bigint not null check (net_minor >= 0),
  currency text not null check (currency in ('USD', 'LRD')),
  unique (payroll_run_id, employee_id)
);

create table {{schema}}.payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references {{schema}}.payslips (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('base', 'allowance', 'deduction')),
  amount_minor bigint not null check (amount_minor >= 0)
);

-- Payslips change only while their run is a draft; approved runs are read-only.
create function {{schema}}.payroll_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_run uuid;
  v_status text;
begin
  if tg_table_name = 'payroll_runs' then
    if tg_op = 'DELETE' and old.status <> 'draft' then
      raise exception 'Approved payroll runs cannot be deleted' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and coalesce(current_setting('corex.payroll_workflow', true), '') <> 'on' then
      raise exception 'Payroll runs change only through prepare, approve and pay' using errcode = '23514';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name = 'payslips' then
    v_run := case when tg_op = 'DELETE' then old.payroll_run_id else new.payroll_run_id end;
  else
    select p.payroll_run_id into v_run from {{schema}}.payslips p
    where p.id = case when tg_op = 'DELETE' then old.payslip_id else new.payslip_id end;
  end if;
  select status into v_status from {{schema}}.payroll_runs where id = v_run;
  -- Lines removed with their payslip (cascade) no longer find the parent row.
  if coalesce(current_setting('corex.payroll_workflow', true), '') <> 'on'
    or (v_status is distinct from 'draft' and not (tg_op = 'DELETE' and v_run is null)) then
    raise exception 'Payslips are calculated by the payroll run and are read-only once approved'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger payroll_runs_guard before update or delete on {{schema}}.payroll_runs
  for each row execute function {{schema}}.payroll_guard();
create trigger payslips_guard before insert or update or delete on {{schema}}.payslips
  for each row execute function {{schema}}.payroll_guard();
create trigger payslip_lines_guard before insert or update or delete on {{schema}}.payslip_lines
  for each row execute function {{schema}}.payroll_guard();

-- Internal: (re)calculates every active employee's payslip for a draft run from the
-- current salaries and components. Amounts round half away from zero.
create function {{schema}}.calculate_payslips(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee {{schema}}.employees%rowtype;
  v_component record;
  v_payslip uuid;
  v_amount bigint;
  v_allowances bigint;
  v_deductions bigint;
  v_count integer := 0;
begin
  perform set_config('corex.payroll_workflow', 'on', true);
  delete from {{schema}}.payslips where payroll_run_id = p_run_id;
  for v_employee in
    select * from {{schema}}.employees where status = 'active' order by employee_number
  loop
    insert into {{schema}}.payslips (
      payroll_run_id, employee_id, gross_minor, total_allowances_minor, total_deductions_minor,
      net_minor, currency
    ) values (p_run_id, v_employee.id, 0, 0, 0, 0, v_employee.currency)
    returning id into v_payslip;
    insert into {{schema}}.payslip_lines (payslip_id, name, kind, amount_minor)
    values (v_payslip, 'Base salary', 'base', v_employee.base_salary_minor);
    v_allowances := 0;
    v_deductions := 0;
    for v_component in
      select c.name, c.kind, c.calc, coalesce(ec.value, c.default_value) as value
      from {{schema}}.employee_components ec
      join {{schema}}.pay_components c on c.id = ec.pay_component_id
      where ec.employee_id = v_employee.id and c.active
      order by c.kind, c.name
    loop
      v_amount := case
        when v_component.calc = 'fixed' then round(v_component.value)
        else round(v_employee.base_salary_minor * v_component.value / 100)
      end::bigint;
      insert into {{schema}}.payslip_lines (payslip_id, name, kind, amount_minor)
      values (v_payslip, v_component.name, v_component.kind, v_amount);
      if v_component.kind = 'allowance' then
        v_allowances := v_allowances + v_amount;
      else
        v_deductions := v_deductions + v_amount;
      end if;
    end loop;
    if v_employee.base_salary_minor + v_allowances - v_deductions < 0 then
      raise exception 'Deductions for % % are more than their pay', v_employee.first_name, v_employee.last_name
        using errcode = '23514';
    end if;
    update {{schema}}.payslips
    set gross_minor = v_employee.base_salary_minor + v_allowances,
        total_allowances_minor = v_allowances,
        total_deductions_minor = v_deductions,
        net_minor = v_employee.base_salary_minor + v_allowances - v_deductions
    where id = v_payslip;
    v_count := v_count + 1;
  end loop;
  perform set_config('corex.payroll_workflow', '', true);
  return v_count;
end;
$$;

revoke execute on function {{schema}}.calculate_payslips(uuid) from authenticated;

-- Creates or recalculates the draft run for a month (Owner or Accountant).
create function {{schema}}.prepare_payroll_run(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_run {{schema}}.payroll_runs%rowtype;
begin
  if (select auth.uid()) is not null and not {{schema}}.is_finance_manager() then
    raise exception 'Only the Owner or Accountant can prepare payroll' using errcode = '42501';
  end if;
  select * into v_run from {{schema}}.payroll_runs where period_month = v_month for update;
  if not found then
    insert into {{schema}}.payroll_runs (period_month) values (v_month) returning * into v_run;
  elsif v_run.status <> 'draft' then
    raise exception 'Payroll for this month is already approved' using errcode = '23514';
  end if;
  perform {{schema}}.calculate_payslips(v_run.id);
  return v_run.id;
end;
$$;

grant execute on function {{schema}}.prepare_payroll_run(date) to authenticated;

-- Approves a draft run (Owner / Admin only, FIN-06). The payslips are recalculated
-- now and kept as they are, so later salary or component changes do not alter them.
create function {{schema}}.approve_payroll_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_count integer;
begin
  if (select auth.uid()) is not null and not {{schema}}.is_finance_owner() then
    raise exception 'Only the Owner can approve payroll' using errcode = '42501';
  end if;
  select status into v_status from {{schema}}.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run not found' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'This payroll run is already approved' using errcode = '23514';
  end if;
  v_count := {{schema}}.calculate_payslips(p_run_id);
  if v_count = 0 then
    raise exception 'There are no active employees to pay' using errcode = '23514';
  end if;
  perform set_config('corex.payroll_workflow', 'on', true);
  update {{schema}}.payroll_runs
  set status = 'approved', approved_by = (select auth.uid()), approved_at = now()
  where id = p_run_id;
  perform set_config('corex.payroll_workflow', '', true);
  return v_count;
end;
$$;

grant execute on function {{schema}}.approve_payroll_run(uuid) to authenticated;

-- Marks an approved run paid and records one expense entry per currency (net pay)
-- from the account given for that currency: p_accounts = {"USD": "<account id>", ...}.
create function {{schema}}.pay_payroll_run(
  p_run_id uuid,
  p_date date,
  p_category_id uuid,
  p_accounts jsonb,
  p_fx_rate numeric default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run {{schema}}.payroll_runs%rowtype;
  v_total record;
  v_account uuid;
  v_count integer := 0;
begin
  if (select auth.uid()) is not null and not {{schema}}.is_finance_owner() then
    raise exception 'Only the Owner can mark payroll paid' using errcode = '42501';
  end if;
  select * into v_run from {{schema}}.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run not found' using errcode = 'P0002';
  end if;
  if v_run.status <> 'approved' then
    raise exception 'Only an approved payroll run can be paid' using errcode = '23514';
  end if;
  if not exists (select 1 from {{schema}}.categories where id = p_category_id and type = 'expense') then
    raise exception 'Choose an expense category' using errcode = '23514';
  end if;
  for v_total in
    select currency, sum(net_minor)::bigint as net, count(*) as people
    from {{schema}}.payslips where payroll_run_id = p_run_id group by currency order by currency
  loop
    if v_total.net = 0 then
      continue;
    end if;
    v_account := nullif(p_accounts ->> v_total.currency, '')::uuid;
    if v_account is null
      or not exists (select 1 from {{schema}}.accounts a where a.id = v_account and a.currency = v_total.currency) then
      raise exception 'Choose a % account to pay from', v_total.currency using errcode = '23514';
    end if;
    perform {{schema}}.record_transaction(
      gen_random_uuid(), 'expense', p_date, v_account, v_total.net, p_category_id, null, null,
      case when v_total.currency = (select base_currency from {{schema}}.settings) then null else p_fx_rate end,
      'Payroll ' || to_char(v_run.period_month, 'Mon YYYY') || ' (' || v_total.people || ' payslips)'
    );
    v_count := v_count + 1;
  end loop;
  perform set_config('corex.payroll_workflow', 'on', true);
  update {{schema}}.payroll_runs set status = 'paid', paid_at = now() where id = p_run_id;
  perform set_config('corex.payroll_workflow', '', true);
  return v_count;
end;
$$;

grant execute on function {{schema}}.pay_payroll_run(uuid, date, uuid, jsonb, numeric) to authenticated;

-- Access ------------------------------------------------------------------------------

alter table {{schema}}.accounts enable row level security;
alter table {{schema}}.categories enable row level security;
alter table {{schema}}.counterparties enable row level security;
alter table {{schema}}.exchange_rates enable row level security;
alter table {{schema}}.transactions enable row level security;
alter table {{schema}}.employees enable row level security;
alter table {{schema}}.pay_components enable row level security;
alter table {{schema}}.employee_components enable row level security;
alter table {{schema}}.payroll_runs enable row level security;
alter table {{schema}}.payslips enable row level security;
alter table {{schema}}.payslip_lines enable row level security;

-- Every member reads the lists needed to record an entry; managers maintain them.
create policy accounts_read on {{schema}}.accounts
  for select to authenticated using ((select {{schema}}.is_member()));
create policy accounts_write on {{schema}}.accounts
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy categories_read on {{schema}}.categories
  for select to authenticated using ((select {{schema}}.is_member()));
create policy categories_write on {{schema}}.categories
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy counterparties_read on {{schema}}.counterparties
  for select to authenticated using ((select {{schema}}.is_member()));
create policy counterparties_insert on {{schema}}.counterparties
  for insert to authenticated with check ((select {{schema}}.is_member()));
create policy counterparties_update on {{schema}}.counterparties
  for update to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy exchange_rates_read on {{schema}}.exchange_rates
  for select to authenticated using ((select {{schema}}.is_member()));
create policy exchange_rates_write on {{schema}}.exchange_rates
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));

-- Managers see every entry; Staff see the entries they recorded (PROGRESS.md D38),
-- which also keeps payroll totals and balances from them (FIN-07).
create policy transactions_manager_read on {{schema}}.transactions
  for select to authenticated using ((select {{schema}}.is_finance_manager()));
create policy transactions_own_read on {{schema}}.transactions
  for select to authenticated using (created_by = (select auth.uid()));
revoke insert, update, delete on {{schema}}.transactions from authenticated;

-- Payroll is for the Owner and Accountant only (FIN-07).
create policy employees_manager on {{schema}}.employees
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy pay_components_manager on {{schema}}.pay_components
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy employee_components_manager on {{schema}}.employee_components
  for all to authenticated
  using ((select {{schema}}.is_finance_manager())) with check ((select {{schema}}.is_finance_manager()));
create policy payroll_runs_manager_read on {{schema}}.payroll_runs
  for select to authenticated using ((select {{schema}}.is_finance_manager()));
create policy payslips_manager_read on {{schema}}.payslips
  for select to authenticated using ((select {{schema}}.is_finance_manager()));
create policy payslip_lines_manager_read on {{schema}}.payslip_lines
  for select to authenticated using ((select {{schema}}.is_finance_manager()));
revoke insert, update, delete on {{schema}}.payroll_runs from authenticated;
revoke insert, update, delete on {{schema}}.payslips from authenticated;
revoke insert, update, delete on {{schema}}.payslip_lines from authenticated;

-- Never deleted: reference rows are deactivated instead.
create trigger accounts_never_delete before delete on {{schema}}.accounts
  for each row execute function {{schema}}.never_delete();
create trigger categories_never_delete before delete on {{schema}}.categories
  for each row execute function {{schema}}.never_delete();
create trigger employees_never_delete before delete on {{schema}}.employees
  for each row execute function {{schema}}.never_delete();

-- Audit (CORE-03) ---------------------------------------------------------------------

select {{schema}}.enable_audit('{{schema}}.accounts');
select {{schema}}.enable_audit('{{schema}}.categories');
select {{schema}}.enable_audit('{{schema}}.counterparties');
select {{schema}}.enable_audit('{{schema}}.exchange_rates');
select {{schema}}.enable_audit('{{schema}}.transactions');
select {{schema}}.enable_audit('{{schema}}.employees');
select {{schema}}.enable_audit('{{schema}}.pay_components');
select {{schema}}.enable_audit('{{schema}}.employee_components');
select {{schema}}.enable_audit('{{schema}}.payroll_runs');
select {{schema}}.enable_audit('{{schema}}.payslips');
select {{schema}}.enable_audit('{{schema}}.payslip_lines');
