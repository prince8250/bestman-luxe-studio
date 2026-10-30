-- =============================================================================
-- Who is calling, and writing the history.
--
-- Like a Spring Security filter, every POS read is filtered by RLS using these
-- helpers, and every POS function re-checks the caller's role with
-- private.require_pos_user() before it writes anything.
-- =============================================================================

-- The caller's POS role ('owner' or 'counter'), or null when the caller is not
-- an active POS user. security definer so it can read profiles under RLS.
create or replace function private.pos_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function private.is_pos_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pos_role() is not null
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.pos_role() = 'owner', false)
$$;

-- Returns the caller (id, role, display name) or raises not_authorized.
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
    where p.id = (select auth.uid()) and p.active and p.role = any (p_roles);
  if not found then
    raise exception 'not_authorized'
      using detail = 'This action needs a signed-in POS user with the right role.',
            errcode = '42501';
  end if;
end;
$$;

-- Counter users see sales from the current business day only (sales made
-- today, and past sales recorded today). The owner sees everything.
create or replace function private.can_see_sale(p_business_date date, p_recorded_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.pos_role()
    when 'owner' then true
    when 'counter' then p_business_date = private.accra_today()
                     or private.accra_date(p_recorded_at) = private.accra_today()
    else false
  end
$$;

-- -----------------------------------------------------------------------------
-- Writing history
-- -----------------------------------------------------------------------------

-- Appends one audit row. The actor comes from the session: a POS user, or
-- 'system' (service role / database jobs) unless the caller says 'public'.
create or replace function private.write_audit(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_role text;
  v_name text;
begin
  if v_actor_id is not null then
    select p.role, p.display_name into v_role, v_name from public.profiles p where p.id = v_actor_id;
  end if;
  insert into public.audit_log (actor_id, actor_name, actor_role, entity, entity_id, action, before, after, reason)
  values (
    case when v_role is null then null else v_actor_id end,
    v_name,
    coalesce(p_actor_role, v_role, 'system'),
    p_entity,
    p_entity_id,
    p_action,
    p_before,
    p_after,
    nullif(trim(p_reason), '')
  );
end;
$$;

-- Queues an alert for the owner, at most once per occurrence: a second call
-- with the same key (a retry, a repeated job run) does nothing. Sale alerts
-- default to '<kind>:<sale id>'. Sending (and the on/off toggles and the
-- daily cap) is handled by the alert sender in spec 19.
create or replace function private.create_owner_alert(
  p_kind text,
  p_sale_id uuid,
  p_payload jsonb,
  p_occurrence_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.owner_alerts (kind, sale_id, occurrence_key, payload)
  values (
    p_kind,
    p_sale_id,
    coalesce(p_occurrence_key, case when p_sale_id is not null then p_kind || ':' || p_sale_id::text end),
    coalesce(p_payload, '{}'::jsonb))
  on conflict (occurrence_key) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Automatic history for catalog, staff, settings, and customer blocking.
-- Triggers run inside the same transaction as the change, so a change can
-- never be saved without its history row.
-- -----------------------------------------------------------------------------

create or replace function private.audit_service_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is distinct from old.price then
    perform private.write_audit('service', new.id, 'service_price_changed',
      jsonb_build_object('name', old.name, 'price', old.price),
      jsonb_build_object('name', new.name, 'price', new.price));
  end if;
  if old.active and not new.active then
    perform private.write_audit('service', new.id, 'service_archived', null, jsonb_build_object('name', new.name));
  elsif not old.active and new.active then
    perform private.write_audit('service', new.id, 'service_restored', null, jsonb_build_object('name', new.name));
  end if;
  return null;
end;
$$;

create trigger services_audit after update on public.services
  for each row execute function private.audit_service_change();

create or replace function private.audit_staff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.active and not new.active then
    perform private.write_audit('staff', new.id, 'staff_archived', null, jsonb_build_object('name', new.name));
  elsif not old.active and new.active then
    perform private.write_audit('staff', new.id, 'staff_restored', null, jsonb_build_object('name', new.name));
  end if;
  return null;
end;
$$;

create trigger staff_audit after update on public.staff
  for each row execute function private.audit_staff_change();

-- Records only the settings that changed (before and after).
create or replace function private.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old) - 'updated_at' - 'updated_by';
  v_new jsonb := to_jsonb(new) - 'updated_at' - 'updated_by';
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_key text;
begin
  for v_key in select jsonb_object_keys(v_new) loop
    if v_old -> v_key is distinct from v_new -> v_key then
      v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
      v_after := v_after || jsonb_build_object(v_key, v_new -> v_key);
    end if;
  end loop;
  if v_after <> '{}'::jsonb then
    perform private.write_audit('settings', null, 'settings_changed', v_before, v_after);
  end if;
  return null;
end;
$$;

create trigger studio_settings_audit after update on public.studio_settings
  for each row execute function private.audit_settings_change();

-- Customers: the phone number is the identity and never changes; only the
-- owner may block or unblock a number.
create or replace function private.guard_customer_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    raise exception 'phone_not_editable'
      using detail = 'A customer''s phone number is their identity and cannot be changed.',
            errcode = '42501';
  end if;
  if (new.blocked is distinct from old.blocked or new.blocked_reason is distinct from old.blocked_reason)
     and (select auth.uid()) is not null
     and not private.is_owner() then
    raise exception 'not_authorized'
      using detail = 'Only the owner can block or unblock a number.',
            errcode = '42501';
  end if;
  if not new.blocked then
    new.blocked_reason := null;
  end if;
  return new;
end;
$$;

create trigger customers_guard before update on public.customers
  for each row execute function private.guard_customer_change();

create or replace function private.audit_customer_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.blocked and not old.blocked then
    perform private.write_audit('customer', new.id, 'customer_blocked', null,
      jsonb_build_object('phone', new.phone), new.blocked_reason);
  elsif old.blocked and not new.blocked then
    perform private.write_audit('customer', new.id, 'customer_unblocked', null,
      jsonb_build_object('phone', new.phone));
  end if;
  return null;
end;
$$;

create trigger customers_audit after update on public.customers
  for each row execute function private.audit_customer_block();
