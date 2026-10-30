-- =============================================================================
-- Row Level Security, grants, public views, and storage.
--
-- RLS works like a security filter on every query: Postgres adds the policy's
-- condition to each read and write for that role. Hiding a button in the UI is
-- never access control; these rules are.
--
-- Roles:
-- - anon: website visitors. Read only the public catalog. Never money,
--   customers, appointments, or history.
-- - authenticated: signed-in users. Policies further require an active POS
--   profile (private.is_pos_user / private.is_owner).
-- - service_role: server-only code (public booking, backups). Bypasses RLS.
--
-- The project has "automatically expose new tables" switched off, so every
-- grant is explicit here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS on every table (also enforced by the project's automatic-RLS trigger).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sign_in_events enable row level security;
alter table public.studio_settings enable row level security;
alter table public.customers enable row level security;
alter table public.staff enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_staff enable row level security;
alter table public.staff_hours enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.offers enable row level security;
alter table public.gallery_images enable row level security;
alter table public.rate_limits enable row level security;
alter table public.backup_runs enable row level security;
alter table public.audit_log enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.appointments enable row level security;
alter table public.void_requests enable row level security;
alter table public.day_closes enable row level security;
alter table public.owner_alerts enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges. Policies below narrow these down row by row.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Website visitors: the public catalog only.
grant select on public.service_categories, public.services, public.service_staff,
  public.offers, public.gallery_images to anon;
-- Column grants: anon can never read a staff member's phone number, or any
-- internal setting (receipt text, counter limits, the owner's phone).
grant select (id, name, title, photo_path, bio, show_on_website, bookable_online, active, sort_order)
  on public.staff to anon;
grant select (id, studio_name, phone, whatsapp, address, map_url, opening_hours, social_links, about_text)
  on public.studio_settings to anon;

-- POS users: read the business tables; RLS decides which rows.
grant select on all tables in schema public to authenticated;
revoke select on public.rate_limits from authenticated;

-- Catalog and content: written by the owner (policies check the role).
grant insert, update, delete on public.staff, public.service_categories, public.services,
  public.service_staff, public.staff_hours, public.staff_time_off, public.offers,
  public.gallery_images to authenticated;
grant update on public.studio_settings to authenticated;

-- Narrow column-level writes.
grant update (full_name, notes, blocked, blocked_reason) on public.customers to authenticated;
grant update (seen_at, notes) on public.appointments to authenticated;
grant update (activity_seen_at) on public.profiles to authenticated;
grant insert on public.sign_in_events to authenticated;

-- Sales, payments, voids, day closes, alerts, and the audit log have NO direct
-- write grants for anon or authenticated: they change only through the
-- security-definer functions, which check the role and write the history.

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- profiles: your own row; the owner sees every account.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_owner());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- sign_in_events: written by the user signing in; read by the owner.
create policy sign_in_events_insert on public.sign_in_events for insert to authenticated
  with check (profile_id = (select auth.uid()) and private.is_pos_user());
create policy sign_in_events_select on public.sign_in_events for select to authenticated
  using (private.is_owner() or profile_id = (select auth.uid()));

-- studio_settings: public fields for visitors (column grants), all fields for
-- POS users, edits by the owner.
create policy studio_settings_public_select on public.studio_settings for select to anon using (true);
create policy studio_settings_pos_select on public.studio_settings for select to authenticated
  using (private.is_pos_user());
create policy studio_settings_owner_update on public.studio_settings for update to authenticated
  using (private.is_owner()) with check (private.is_owner());

-- customers: POS users read and edit name and notes; blocking is owner-only
-- (enforced by the customers_guard trigger). Created only by the functions.
create policy customers_select on public.customers for select to authenticated using (private.is_pos_user());
create policy customers_update on public.customers for update to authenticated
  using (private.is_pos_user()) with check (private.is_pos_user());

-- staff
create policy staff_public_select on public.staff for select to anon using (active and show_on_website);
create policy staff_pos_select on public.staff for select to authenticated using (private.is_pos_user());
create policy staff_owner_insert on public.staff for insert to authenticated with check (private.is_owner());
create policy staff_owner_update on public.staff for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy staff_owner_delete on public.staff for delete to authenticated using (private.is_owner());

-- service_categories
create policy categories_public_select on public.service_categories for select to anon using (active);
create policy categories_pos_select on public.service_categories for select to authenticated using (private.is_pos_user());
create policy categories_owner_insert on public.service_categories for insert to authenticated with check (private.is_owner());
create policy categories_owner_update on public.service_categories for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy categories_owner_delete on public.service_categories for delete to authenticated using (private.is_owner());

-- services
create policy services_public_select on public.services for select to anon using (active and show_on_website);
create policy services_pos_select on public.services for select to authenticated using (private.is_pos_user());
create policy services_owner_insert on public.services for insert to authenticated with check (private.is_owner());
create policy services_owner_update on public.services for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy services_owner_delete on public.services for delete to authenticated using (private.is_owner());

-- service_staff (which staff do which service: not sensitive)
create policy service_staff_public_select on public.service_staff for select to anon using (true);
create policy service_staff_pos_select on public.service_staff for select to authenticated using (private.is_pos_user());
create policy service_staff_owner_insert on public.service_staff for insert to authenticated with check (private.is_owner());
create policy service_staff_owner_update on public.service_staff for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy service_staff_owner_delete on public.service_staff for delete to authenticated using (private.is_owner());

-- staff_hours and staff_time_off (the booking server reads them with the service role)
create policy staff_hours_pos_select on public.staff_hours for select to authenticated using (private.is_pos_user());
create policy staff_hours_owner_insert on public.staff_hours for insert to authenticated with check (private.is_owner());
create policy staff_hours_owner_update on public.staff_hours for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy staff_hours_owner_delete on public.staff_hours for delete to authenticated using (private.is_owner());

create policy staff_time_off_pos_select on public.staff_time_off for select to authenticated using (private.is_pos_user());
create policy staff_time_off_owner_insert on public.staff_time_off for insert to authenticated with check (private.is_owner());
create policy staff_time_off_owner_update on public.staff_time_off for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy staff_time_off_owner_delete on public.staff_time_off for delete to authenticated using (private.is_owner());

-- offers and gallery
create policy offers_public_select on public.offers for select to anon using (active);
create policy offers_pos_select on public.offers for select to authenticated using (private.is_pos_user());
create policy offers_owner_insert on public.offers for insert to authenticated with check (private.is_owner());
create policy offers_owner_update on public.offers for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy offers_owner_delete on public.offers for delete to authenticated using (private.is_owner());

create policy gallery_public_select on public.gallery_images for select to anon using (active);
create policy gallery_pos_select on public.gallery_images for select to authenticated using (private.is_pos_user());
create policy gallery_owner_insert on public.gallery_images for insert to authenticated with check (private.is_owner());
create policy gallery_owner_update on public.gallery_images for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy gallery_owner_delete on public.gallery_images for delete to authenticated using (private.is_owner());

-- appointments: POS users read and mark as seen; status changes go through
-- the functions (create_sale, cancel_appointment, mark_no_show).
create policy appointments_select on public.appointments for select to authenticated using (private.is_pos_user());
create policy appointments_update on public.appointments for update to authenticated
  using (private.is_pos_user()) with check (private.is_pos_user());

-- sales and their lines and payments: the owner sees all; the counter sees the
-- current business day only (private.can_see_sale).
create policy sales_select on public.sales for select to authenticated
  using (private.can_see_sale(business_date, recorded_at));
-- A line or payment is visible exactly when its sale is (the subquery on
-- sales is itself filtered by the sales policy).
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_items.sale_id));
create policy sale_payments_select on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_payments.sale_id));

-- void requests: the owner sees all; a counter user sees their own.
create policy void_requests_select on public.void_requests for select to authenticated
  using (private.is_owner() or (private.is_pos_user() and requested_by = (select auth.uid())));

-- day closes: the owner sees the history; the counter sees today's status only.
create policy day_closes_select on public.day_closes for select to authenticated
  using (private.is_owner() or (private.is_pos_user() and business_date = private.accra_today()));

-- Owner-only reading.
create policy owner_alerts_select on public.owner_alerts for select to authenticated using (private.is_owner());
create policy audit_log_select on public.audit_log for select to authenticated using (private.is_owner());
create policy backup_runs_select on public.backup_runs for select to authenticated using (private.is_owner());

-- rate_limits: no policies at all (service role only).

-- -----------------------------------------------------------------------------
-- Public views (security_invoker: they run with the visitor's permissions, so
-- the column grants and RLS above still apply).
-- -----------------------------------------------------------------------------
create view public.public_staff with (security_invoker = true) as
  select id, name, title, photo_path, bio, bookable_online, sort_order
  from public.staff
  where active and show_on_website;

create view public.public_studio_settings with (security_invoker = true) as
  select studio_name, phone, whatsapp, address, map_url, opening_hours, social_links, about_text
  from public.studio_settings;

grant select on public.public_staff, public.public_studio_settings to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Function privileges. Nothing is callable unless granted here.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Helpers used inside RLS policies (they run as the querying user).
grant execute on function
  private.pos_role(),
  private.is_pos_user(),
  private.is_owner(),
  private.can_see_sale(date, timestamptz),
  private.accra_date(timestamptz),
  private.accra_today()
to authenticated;

grant execute on function
  public.create_sale(jsonb),
  public.reassign_sale_item_staff(uuid, uuid, text),
  public.edit_sale_item(uuid, jsonb, jsonb, text),
  public.void_sale(uuid, text),
  public.request_void(uuid, text),
  public.cancel_void_request(uuid),
  public.decide_void_request(uuid, boolean, text),
  public.close_day(date, integer, integer, integer, text, text),
  public.reopen_day(date, text),
  public.cancel_appointment(uuid, text),
  public.mark_no_show(uuid)
to authenticated;

-- Public booking and phone bookings go through server-only code.
grant execute on function public.create_appointment(jsonb) to service_role;

-- Future functions are not callable by anon or authenticated by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: three public-read image buckets written by the owner, and one
-- private bucket for the weekly backups (service role only).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('staff', 'staff', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('backups', 'backups', false, 52428800, null)
on conflict (id) do nothing;

create policy images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('gallery', 'staff', 'catalog') and private.is_owner());
create policy images_owner_update on storage.objects for update to authenticated
  using (bucket_id in ('gallery', 'staff', 'catalog') and private.is_owner())
  with check (bucket_id in ('gallery', 'staff', 'catalog') and private.is_owner());
create policy images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('gallery', 'staff', 'catalog') and private.is_owner());
-- No policy mentions the backups bucket: only the service role can touch it.
