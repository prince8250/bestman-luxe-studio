-- =============================================================================
-- Foundation: extensions, the private schema, shared helpers, and the tables
-- that do not involve money.
--
-- Conventions used in every migration:
-- - Money is integer pesewas (1 GHS = 100 pesewas). Never numeric or float.
-- - Timestamps are timestamptz (stored in UTC). "Which day is it" is always
--   computed in Africa/Accra with private.accra_date().
-- - Phones are stored in E.164 (+233...). The app normalizes them first.
-- - Statuses are text with check constraints (easy to read, easy to extend).
-- - `private` holds helpers that the website and POS must never call directly.
--   It is not exposed through the Supabase Data API.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
-- RLS policies run as the signed-in user and call private.* helpers.
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Time and formatting helpers
-- -----------------------------------------------------------------------------

-- The studio's business day for a moment in time.
create or replace function private.accra_date(ts timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (ts at time zone 'Africa/Accra')::date
$$;

create or replace function private.accra_today()
returns date
language sql
stable
set search_path = ''
as $$
  select private.accra_date(now())
$$;

-- E.164 phone check, shared by every phone column.
create or replace function private.is_e164(phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select phone ~ '^\+[1-9][0-9]{7,14}$'
$$;

-- Keeps updated_at honest on every table that has one.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- POS users. Only the owner and counter accounts exist; staff never log in.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role text not null check (role in ('owner', 'counter')),
  active boolean not null default true,
  -- When the owner last opened the activity feed (unread count, spec 19).
  activity_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'POS users only: one owner and one counter account per employee. Staff are records in public.staff, never logins.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.sign_in_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  user_agent text check (length(user_agent) <= 400)
);
create index sign_in_events_signed_in_at_idx on public.sign_in_events (signed_in_at desc);
create index sign_in_events_profile_idx on public.sign_in_events (profile_id, signed_in_at desc);
comment on table public.sign_in_events is 'One row per successful POS sign-in, so the owner can see when the shop opened.';

-- -----------------------------------------------------------------------------
-- Studio settings: exactly one row (id is always true).
-- -----------------------------------------------------------------------------
create table public.studio_settings (
  id boolean primary key default true check (id),
  studio_name text not null default 'Bestman Luxe Studio' check (length(trim(studio_name)) between 1 and 80),
  phone text check (phone is null or private.is_e164(phone)),
  whatsapp text check (whatsapp is null or private.is_e164(whatsapp)),
  address text check (length(address) <= 200),
  map_url text check (map_url is null or map_url ~ '^https://'),
  -- [{"day": "Monday", "hours": "08:00 – 20:00"}, ...]
  opening_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(opening_hours) = 'array'),
  -- {"instagram": "https://...", "facebook": "...", "tiktok": "...", "snapchat": "...", "x": "..."}
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  about_text text check (length(about_text) <= 2000),
  receipt_header text check (length(receipt_header) <= 200),
  receipt_footer text check (length(receipt_footer) <= 300),
  receipt_copies smallint not null default 2 check (receipt_copies between 1 and 3),
  booking_sound boolean not null default true,
  -- Counter controls (architecture-context.md, "Counter Controls").
  max_counter_discount_percent smallint not null default 20 check (max_counter_discount_percent between 0 and 100),
  counter_backdate_days smallint not null default 3 check (counter_backdate_days between 0 and 14),
  default_opening_float integer not null default 0 check (default_opening_float >= 0),
  cash_difference_tolerance integer not null default 0 check (cash_difference_tolerance >= 0),
  -- A price change on one line bigger than this many pesewas alerts the owner.
  override_alert_threshold integer not null default 5000 check (override_alert_threshold >= 0),
  -- Owner alerts (sent in spec 19).
  owner_alert_phone text check (owner_alert_phone is null or private.is_e164(owner_alert_phone)),
  alert_settings jsonb not null default '{
    "void_requested": true,
    "cash_difference": true,
    "backdated_sale": true,
    "large_override": true,
    "after_close_sale": true,
    "day_summary": true,
    "day_not_closed": true,
    "backup_stale": true
  }'::jsonb check (jsonb_typeof(alert_settings) = 'object'),
  daily_sms_cap smallint not null default 20 check (daily_sms_cap between 0 and 200),
  -- Online booking rules (specs 31 and 34).
  booking_lead_minutes smallint not null default 60 check (booking_lead_minutes between 0 and 1440),
  slot_interval_minutes smallint not null default 30 check (slot_interval_minutes in (15, 20, 30, 60)),
  max_upcoming_per_phone smallint not null default 2 check (max_upcoming_per_phone between 1 and 10),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
comment on table public.studio_settings is 'Single row of studio details and counter controls, edited by the owner in POS Settings.';

create trigger studio_settings_updated_at before update on public.studio_settings
  for each row execute function private.set_updated_at();

insert into public.studio_settings default values;

-- -----------------------------------------------------------------------------
-- Customers: one row per phone number, created by sales and appointments.
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (private.is_e164(phone)),
  full_name text check (full_name is null or length(trim(full_name)) between 1 and 80),
  blocked boolean not null default false,
  blocked_reason text check (length(blocked_reason) <= 300),
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not blocked or nullif(trim(blocked_reason), '') is not null)
);
create index customers_full_name_idx on public.customers (lower(full_name));

create trigger customers_updated_at before update on public.customers
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catalog: staff, categories, services, and who can do what.
-- -----------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  title text check (length(title) <= 60),
  -- Internal only; never shown on the website (see the column grants for anon).
  phone text check (phone is null or private.is_e164(phone)),
  photo_path text,
  bio text check (length(bio) <= 500),
  show_on_website boolean not null default true,
  bookable_online boolean not null default true,
  active boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archived_at is null or not active)
);
comment on table public.staff is 'People who do the work. A record, never a login. Removed staff are archived (active = false), never deleted when they have history.';

create trigger staff_updated_at before update on public.staff
  for each row execute function private.set_updated_at();

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  tagline text check (length(tagline) <= 120),
  image_path text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_categories_updated_at before update on public.service_categories
  for each row execute function private.set_updated_at();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 500),
  image_path text,
  price integer not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  show_on_website boolean not null default true,
  bookable_online boolean not null default true,
  active boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archived_at is null or not active)
);
create index services_category_idx on public.services (category_id, sort_order);

create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();

create table public.service_staff (
  service_id uuid not null references public.services (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  primary key (service_id, staff_id)
);
create index service_staff_staff_idx on public.service_staff (staff_id);
comment on table public.service_staff is 'Which staff can perform which service. Used by online booking and as the default staff filter in New sale.';

-- Weekly working hours. weekday follows ISO: 1 = Monday ... 7 = Sunday.
-- Several rows on one weekday make a split day.
create table public.staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index staff_hours_staff_idx on public.staff_hours (staff_id, weekday);

create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text check (length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index staff_time_off_staff_idx on public.staff_time_off (staff_id, starts_on);

-- -----------------------------------------------------------------------------
-- Website content managed in the POS.
-- -----------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 80),
  description text check (length(description) <= 500),
  image_path text,
  service_id uuid references public.services (id) on delete set null,
  active boolean not null default true,
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create trigger offers_updated_at before update on public.offers
  for each row execute function private.set_updated_at();

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  caption text check (length(caption) <= 140),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gallery_images_updated_at before update on public.gallery_images
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Operational tables.
-- -----------------------------------------------------------------------------

-- Booking abuse protection counters (spec 34). Key is a hashed phone or IP.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily_pc', 'weekly_cloud', 'manual_download')),
  status text not null check (status in ('success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  file_name text,
  storage_path text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  row_counts jsonb,
  message text check (length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index backup_runs_created_idx on public.backup_runs (kind, created_at desc);

-- -----------------------------------------------------------------------------
-- Audit log: append-only history of who changed what, and why.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No foreign key on purpose: the history must outlive any account.
  actor_id uuid,
  actor_name text,
  actor_role text not null check (actor_role in ('owner', 'counter', 'system', 'public')),
  -- sale, sale_item, service, category, staff, appointment, settings, customer,
  -- day_close, void_request, profile, offer, gallery, backup, system
  entity text not null check (length(entity) between 1 and 40),
  entity_id uuid,
  -- For example staff_reassigned, item_price_changed, sale_voided, service_price_changed.
  action text not null check (length(action) between 1 and 60),
  before jsonb,
  after jsonb,
  reason text check (length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
comment on table public.audit_log is 'Append-only. Updates, deletes, and truncates are refused by triggers, for every role including the owner.';

create or replace function private.refuse_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log_is_append_only'
    using detail = 'Rows in audit_log can never be changed or removed.',
          errcode = '42501';
end;
$$;

create trigger audit_log_no_update_or_delete
  before update or delete on public.audit_log
  for each row execute function private.refuse_audit_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.refuse_audit_change();

-- -----------------------------------------------------------------------------
-- Sample data registry. seed.sql records every sample row it creates here, so
-- public.remove_sample_data() can remove exactly those rows and nothing else.
-- -----------------------------------------------------------------------------
create table private.sample_rows (
  table_name text not null,
  row_id uuid not null,
  primary key (table_name, row_id)
);
