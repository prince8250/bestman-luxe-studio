-- =============================================================================
-- Spec 07: "sign out everywhere" must take effect at once.
--
-- 1. A POS user now also needs a live Auth session: the session_id inside the
--    access token must still exist in auth.sessions. Ending a person's
--    sessions (password reset, deactivation, "sign out of all devices")
--    therefore locks them out on their very next request, instead of when
--    their current access token expires (up to an hour later).
-- 2. public.end_user_sessions(user) deletes those sessions (service role only;
--    the server action checks that the caller is the owner first).
-- 3. Every policy now calls the identity helpers as (select ...), which lets
--    Postgres run them once per query instead of once per row (Supabase's
--    recommended RLS pattern; reports read thousands of rows).
-- =============================================================================

create or replace function private.has_live_session(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
      and s.user_id = p_user_id
      and (s.not_after is null or s.not_after > now())
  )
$$;

create or replace function private.pos_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.active and private.has_live_session(p.id)
$$;

create or replace function private.require_pos_user(p_roles text[] default array['owner', 'counter'])
returns table (user_id uuid, user_role text, user_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select p.id, p.role, p.display_name
    from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = any (p_roles) and private.has_live_session(p.id);
  if not found then
    raise exception 'not_authorized'
      using detail = 'This action needs a signed-in POS user with the right role.',
            errcode = '42501';
  end if;
end;
$$;

-- Ends every session of one account (all devices).
create or replace function public.end_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.has_live_session(uuid) from public, anon;
grant execute on function private.has_live_session(uuid) to authenticated;
revoke execute on function public.end_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.end_user_sessions(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Policies: same rules, helpers evaluated once per query.
-- -----------------------------------------------------------------------------
alter policy profiles_select on public.profiles using (id = (select auth.uid()) or (select private.is_owner()));
alter policy sign_in_events_insert on public.sign_in_events
  with check (profile_id = (select auth.uid()) and (select private.is_pos_user()));
alter policy sign_in_events_select on public.sign_in_events
  using ((select private.is_owner()) or profile_id = (select auth.uid()));
alter policy studio_settings_pos_select on public.studio_settings using ((select private.is_pos_user()));
alter policy studio_settings_owner_update on public.studio_settings
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy customers_select on public.customers using ((select private.is_pos_user()));
alter policy customers_update on public.customers
  using ((select private.is_pos_user())) with check ((select private.is_pos_user()));

alter policy staff_pos_select on public.staff using ((select private.is_pos_user()));
alter policy staff_owner_insert on public.staff with check ((select private.is_owner()));
alter policy staff_owner_update on public.staff using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy staff_owner_delete on public.staff using ((select private.is_owner()));

alter policy categories_pos_select on public.service_categories using ((select private.is_pos_user()));
alter policy categories_owner_insert on public.service_categories with check ((select private.is_owner()));
alter policy categories_owner_update on public.service_categories
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy categories_owner_delete on public.service_categories using ((select private.is_owner()));

alter policy services_pos_select on public.services using ((select private.is_pos_user()));
alter policy services_owner_insert on public.services with check ((select private.is_owner()));
alter policy services_owner_update on public.services using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy services_owner_delete on public.services using ((select private.is_owner()));

alter policy service_staff_pos_select on public.service_staff using ((select private.is_pos_user()));
alter policy service_staff_owner_insert on public.service_staff with check ((select private.is_owner()));
alter policy service_staff_owner_update on public.service_staff
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy service_staff_owner_delete on public.service_staff using ((select private.is_owner()));

alter policy staff_hours_pos_select on public.staff_hours using ((select private.is_pos_user()));
alter policy staff_hours_owner_insert on public.staff_hours with check ((select private.is_owner()));
alter policy staff_hours_owner_update on public.staff_hours
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy staff_hours_owner_delete on public.staff_hours using ((select private.is_owner()));

alter policy staff_time_off_pos_select on public.staff_time_off using ((select private.is_pos_user()));
alter policy staff_time_off_owner_insert on public.staff_time_off with check ((select private.is_owner()));
alter policy staff_time_off_owner_update on public.staff_time_off
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy staff_time_off_owner_delete on public.staff_time_off using ((select private.is_owner()));

alter policy offers_pos_select on public.offers using ((select private.is_pos_user()));
alter policy offers_owner_insert on public.offers with check ((select private.is_owner()));
alter policy offers_owner_update on public.offers using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy offers_owner_delete on public.offers using ((select private.is_owner()));

alter policy gallery_pos_select on public.gallery_images using ((select private.is_pos_user()));
alter policy gallery_owner_insert on public.gallery_images with check ((select private.is_owner()));
alter policy gallery_owner_update on public.gallery_images
  using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy gallery_owner_delete on public.gallery_images using ((select private.is_owner()));

alter policy appointments_select on public.appointments using ((select private.is_pos_user()));
alter policy appointments_update on public.appointments
  using ((select private.is_pos_user())) with check ((select private.is_pos_user()));

-- Counter users: the current business day only (sales made today, and past
-- sales recorded today). The owner: everything.
alter policy sales_select on public.sales using (
  (select private.is_owner())
  or (
    (select private.pos_role()) = 'counter'
    and (business_date = (select private.accra_today())
         or private.accra_date(recorded_at) = (select private.accra_today()))
  )
);

alter policy void_requests_select on public.void_requests
  using ((select private.is_owner()) or ((select private.is_pos_user()) and requested_by = (select auth.uid())));
alter policy day_closes_select on public.day_closes
  using ((select private.is_owner()) or ((select private.is_pos_user()) and business_date = (select private.accra_today())));
alter policy owner_alerts_select on public.owner_alerts using ((select private.is_owner()));
alter policy audit_log_select on public.audit_log using ((select private.is_owner()));
alter policy backup_runs_select on public.backup_runs using ((select private.is_owner()));

alter policy images_owner_insert on storage.objects
  with check (bucket_id in ('gallery', 'staff', 'catalog') and (select private.is_owner()));
alter policy images_owner_update on storage.objects
  using (bucket_id in ('gallery', 'staff', 'catalog') and (select private.is_owner()))
  with check (bucket_id in ('gallery', 'staff', 'catalog') and (select private.is_owner()));
alter policy images_owner_delete on storage.objects
  using (bucket_id in ('gallery', 'staff', 'catalog') and (select private.is_owner()));
alter policy images_owner_select on storage.objects
  using (bucket_id in ('gallery', 'staff', 'catalog') and (select private.is_owner()));
