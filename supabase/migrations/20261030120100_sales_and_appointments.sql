-- =============================================================================
-- Money and time: sales (receipts), their lines and payments, appointments,
-- void requests, day closes, and owner alerts.
--
-- An appointment is a promise of a future time slot. A sale is what was done
-- and paid at the counter. Revenue comes only from paid sales.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Receipt numbers: BLS-000001, BLS-000002, ... from a sequence. Gaps (from a
-- failed transaction) are normal and expected.
-- -----------------------------------------------------------------------------
create sequence public.receipt_no_seq;

create or replace function private.next_receipt_no()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'BLS-' || lpad(n::text, greatest(6, length(n::text)), '0')
  from (select nextval('public.receipt_no_seq') as n) as next_value
$$;

-- -----------------------------------------------------------------------------
-- Sales: the receipt. Created already paid, in one transaction, by
-- public.create_sale(). There is no unpaid or draft sale in the database.
-- -----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique default private.next_receipt_no(),
  customer_id uuid references public.customers (id) on delete restrict,
  -- Snapshots at sale time, so the receipt never changes.
  customer_name text check (length(customer_name) <= 80),
  customer_phone text check (customer_phone is null or private.is_e164(customer_phone)),
  appointment_id uuid unique,
  channel text not null default 'walk_in' check (channel in ('walk_in', 'online_booking', 'phone_booking')),
  status text not null default 'paid' check (status in ('paid', 'voided')),
  -- subtotal = lines before discounts; discount_total = reductions below the
  -- service price; total = what was charged (the sum of line totals).
  subtotal integer not null check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  total integer not null check (total >= 0),
  -- paid_at is the business time of the sale (a backdated sale uses the real
  -- time it happened); recorded_at is when it was entered.
  paid_at timestamptz not null default now(),
  business_date date not null,
  recorded_at timestamptz not null default now(),
  is_backdated boolean not null default false,
  after_close boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  note text check (length(note) <= 500),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete restrict,
  void_reason text check (length(void_reason) <= 500),
  -- Sent by the New sale screen; a double-clicked Confirm returns the first sale.
  client_request_id uuid not null unique,
  updated_at timestamptz not null default now(),
  check (total = subtotal - discount_total),
  check ((status = 'voided') = (voided_at is not null)),
  check (status <> 'voided' or (voided_by is not null and nullif(trim(void_reason), '') is not null))
);
create index sales_business_date_idx on public.sales (business_date, status);
create index sales_customer_idx on public.sales (customer_id, paid_at desc);
create index sales_created_by_idx on public.sales (created_by, business_date);
create index sales_paid_at_idx on public.sales (paid_at desc);
comment on table public.sales is 'The receipt. Never deleted: voiding keeps the row with a reason. Revenue = paid sales grouped by business_date (paid_at in Africa/Accra).';

-- business_date always follows paid_at, so reports can group by an indexed date.
create or replace function private.set_sale_business_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.business_date := private.accra_date(new.paid_at);
  return new;
end;
$$;

create trigger sales_business_date before insert or update of paid_at on public.sales
  for each row execute function private.set_sale_business_date();

create trigger sales_updated_at before update on public.sales
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sale items: one line per service done (or a custom item), with the staff
-- member who did it. Name, price, and duration are snapshots.
-- -----------------------------------------------------------------------------
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  line_no smallint not null check (line_no between 1 and 50),
  -- null for a custom item (a free-text product or extra).
  service_id uuid references public.services (id) on delete restrict,
  item_name text not null check (length(trim(item_name)) between 1 and 80),
  -- Who did the work. Required for services, optional for a custom item.
  staff_id uuid references public.staff (id) on delete restrict,
  -- The service price at sale time (for a custom item, the price typed in).
  list_price integer not null check (list_price >= 0),
  -- What was charged per unit, after any override.
  unit_price integer not null check (unit_price >= 0),
  quantity smallint not null default 1 check (quantity between 1 and 20),
  line_total integer not null,
  price_override_reason text check (length(price_override_reason) <= 300),
  -- Used to show the staff member as busy online (walk-in busy blocks).
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, line_no),
  check (line_total = unit_price * quantity),
  check (service_id is null or staff_id is not null),
  check (unit_price = list_price or nullif(trim(price_override_reason), '') is not null)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_staff_idx on public.sale_items (staff_id);
create index sale_items_service_idx on public.sale_items (service_id);

create trigger sale_items_updated_at before update on public.sale_items
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sale payments. kind = 'payment' rows are positive. kind = 'adjustment' rows
-- record money moved when the owner edits a paid line (negative = refund).
-- -----------------------------------------------------------------------------
create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  kind text not null default 'payment' check (kind in ('payment', 'adjustment')),
  method text not null check (method in ('cash', 'momo', 'card', 'other')),
  -- The amount applied to the sale.
  amount integer not null check (amount <> 0),
  -- Cash handed over (cash only); change = tendered - amount.
  tendered integer,
  reference text check (length(reference) <= 60),
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (kind = 'adjustment' or amount > 0),
  check (tendered is null or (method = 'cash' and kind = 'payment' and tendered >= amount))
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);

-- -----------------------------------------------------------------------------
-- Integrity guard: for every sale, the lines and the payments must both add up
-- to the total. Checked when the transaction commits (deferred), so the
-- functions can insert the sale, its lines, and its payments in any order.
-- Any write path that breaks the rule is rolled back by the database itself.
-- security definer: a deferred trigger runs at COMMIT as the calling user, and
-- RLS must not hide the sale from the check.
-- -----------------------------------------------------------------------------
create or replace function private.check_sale_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_total integer;
  v_items bigint;
  v_payments bigint;
begin
  if tg_table_name = 'sales' then
    v_sale_id := new.id;
  else
    v_sale_id := new.sale_id;
  end if;

  select s.total into v_total from public.sales s where s.id = v_sale_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(i.line_total), 0) into v_items from public.sale_items i where i.sale_id = v_sale_id;
  select coalesce(sum(p.amount), 0) into v_payments from public.sale_payments p where p.sale_id = v_sale_id;

  if v_items <> v_total then
    raise exception 'sale_lines_mismatch'
      using detail = format('Lines add up to %s but the sale total is %s.', v_items, v_total);
  end if;
  if v_payments <> v_total then
    raise exception 'payments_mismatch'
      using detail = format('Payments add up to %s but the sale total is %s.', v_payments, v_total);
  end if;
  return null;
end;
$$;

create constraint trigger sales_balance
  after insert or update on public.sales
  deferrable initially deferred
  for each row execute function private.check_sale_balance();

create constraint trigger sale_items_balance
  after insert or update on public.sale_items
  deferrable initially deferred
  for each row execute function private.check_sale_balance();

create constraint trigger sale_payments_balance
  after insert or update on public.sale_payments
  deferrable initially deferred
  for each row execute function private.check_sale_balance();

-- Money records are never deleted. (Removing sample data uses a dedicated
-- function that temporarily lifts this guard; see remove_sample_data.)
create or replace function private.refuse_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'records_are_never_deleted'
    using detail = format('Rows in %s are kept for history. Void or archive instead.', tg_table_name),
          errcode = '42501';
end;
$$;

create trigger sales_no_delete before delete on public.sales
  for each row execute function private.refuse_delete();
create trigger sale_items_no_delete before delete on public.sale_items
  for each row execute function private.refuse_delete();
create trigger sale_payments_no_delete before delete on public.sale_payments
  for each row execute function private.refuse_delete();

-- -----------------------------------------------------------------------------
-- Appointments: a reserved time slot, made online or by phone. Not money.
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  -- Short code for the counter and the SMS (cannot open the confirmation page).
  code text not null unique check (code ~ '^BK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,6}$'),
  -- Long random token for the confirmation link /booking/[token].
  public_token text not null unique check (length(public_token) >= 32),
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 1 and 80),
  customer_phone text not null check (private.is_e164(customer_phone)),
  service_id uuid not null references public.services (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  staff_preference text not null default 'specific' check (staff_preference in ('specific', 'any')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'arrived', 'cancelled', 'no_show')),
  source text not null check (source in ('web', 'phone')),
  -- Price shown when booking (snapshot). Paid at the studio, never online.
  quoted_price integer not null check (quoted_price >= 0),
  sale_id uuid unique references public.sales (id) on delete restrict,
  sms_status text not null default 'pending' check (sms_status in ('pending', 'sent', 'failed', 'skipped')),
  notes text check (length(notes) <= 500),
  cancel_reason text check (length(cancel_reason) <= 300),
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancelled_at timestamptz,
  -- The POS user who took a phone booking (null for web bookings).
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- When a POS user first opened it (for the "new" badge).
  seen_at timestamptz,
  check (ends_at > starts_at),
  check (status <> 'arrived' or sale_id is not null),
  check (status <> 'cancelled' or nullif(trim(cancel_reason), '') is not null),
  -- The final guard against double booking: no two confirmed appointments
  -- for the same staff member may overlap. Back-to-back is fine ('[)' range).
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);
create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_staff_idx on public.appointments (staff_id, starts_at);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

alter table public.sales
  add constraint sales_appointment_fk foreign key (appointment_id)
  references public.appointments (id) on delete restrict;

-- -----------------------------------------------------------------------------
-- Void requests: the counter asks, the owner decides.
-- -----------------------------------------------------------------------------
create table public.void_requests (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  decision_note text check (length(decision_note) <= 500),
  created_at timestamptz not null default now(),
  check (status = 'pending' or decided_at is not null)
);
-- At most one pending request per sale.
create unique index void_requests_one_pending_idx on public.void_requests (sale_id) where status = 'pending';
create index void_requests_status_idx on public.void_requests (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Day closes (cash-up). A reopened close stays as history; only one close per
-- business date can be active (reopened_at is null) at a time.
-- -----------------------------------------------------------------------------
create table public.day_closes (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  opening_float integer not null check (opening_float >= 0),
  opening_float_reason text check (length(opening_float_reason) <= 300),
  expected_cash integer not null,
  counted_cash integer not null check (counted_cash >= 0),
  -- counted - expected: negative means cash is missing.
  cash_difference integer not null,
  momo_reported integer check (momo_reported is null or momo_reported >= 0),
  expected_momo integer not null,
  expected_card integer not null,
  expected_other integer not null default 0,
  sales_count integer not null check (sales_count >= 0),
  note text check (length(note) <= 500),
  closed_by uuid not null references public.profiles (id) on delete restrict,
  closed_at timestamptz not null default now(),
  reopened_by uuid references public.profiles (id) on delete restrict,
  reopened_at timestamptz,
  reopen_reason text check (length(reopen_reason) <= 300),
  check (cash_difference = counted_cash - expected_cash),
  check (reopened_at is null or (reopened_by is not null and nullif(trim(reopen_reason), '') is not null))
);
create unique index day_closes_one_active_idx on public.day_closes (business_date) where reopened_at is null;
create index day_closes_date_idx on public.day_closes (business_date desc);

create trigger day_closes_no_delete before delete on public.day_closes
  for each row execute function private.refuse_delete();

create or replace function private.is_day_closed(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.day_closes c where c.business_date = p_date and c.reopened_at is null
  )
$$;

-- -----------------------------------------------------------------------------
-- Owner alerts: what the owner should hear about. Also the SMS log (spec 19).
-- -----------------------------------------------------------------------------
create table public.owner_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'void_requested', 'cash_difference', 'backdated_sale', 'large_override',
    'after_close_sale', 'day_summary', 'day_not_closed', 'backup_stale'
  )),
  sale_id uuid references public.sales (id) on delete restrict,
  -- One alert per occurrence, claimed atomically by the unique index below:
  -- '<kind>:<sale id>' for sale alerts (at most one per kind per sale),
  -- '<kind>:<day close id>' for day_summary and cash_difference, and
  -- '<kind>:<YYYY-MM-DD>' for the nightly day_not_closed and backup_stale.
  occurrence_key text,
  payload jsonb not null default '{}'::jsonb,
  sms_status text not null default 'pending' check (sms_status in ('pending', 'sent', 'failed', 'skipped', 'disabled', 'throttled')),
  sms_error text check (length(sms_error) <= 500),
  sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index owner_alerts_created_idx on public.owner_alerts (created_at desc);
create index owner_alerts_kind_sale_idx on public.owner_alerts (kind, sale_id);
create unique index owner_alerts_occurrence_idx on public.owner_alerts (occurrence_key);
create index owner_alerts_pending_idx on public.owner_alerts (sms_status) where sms_status = 'pending';
