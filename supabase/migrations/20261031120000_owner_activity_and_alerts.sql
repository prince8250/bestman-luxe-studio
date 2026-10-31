-- =============================================================================
-- Owner activity feed and SMS alerts (spec 19).
--
-- 1. activity_feed / activity_unread_count (owner): one list of what happened
--    at the counter, built from the tables the events already live in
--    (sales, audit_log, sign_in_events, backup_runs). Nothing is copied.
-- 2. claim_owner_alerts / finish_owner_alert (service role): the SMS sender.
--    The alerts themselves are queued since spec 02 by the functions that
--    cause them (create_sale, request_void, close_day), one row per
--    occurrence_key. Claiming decides each pending row's fate under a lock,
--    so two senders can never send the same alert.
-- 3. owner_daily_check (service role): the 23:30 job's checks (day not
--    closed, no PC backup), keyed by date so a rerun adds nothing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Activity feed
-- -----------------------------------------------------------------------------

-- Feed types (the filter values) and the audit actions behind them.
--   sales, custom, backdated, after_close   one event per sale (tags)
--   overrides      item_price_overridden (a price changed at the counter)
--   reassignments  staff_reassigned
--   edits          item_price_changed, item_service_changed
--   void_requests  void_requested, void_request_approved/_rejected/_cancelled
--   voids          sale_voided
--   appointments   appointment_cancelled, appointment_no_show
--   days           day_closed, day_reopened
--   sign_ins       counter sign-ins
--   backups        failed backups
create or replace function private.activity_events(
  p_since timestamptz, p_before timestamptz, p_limit integer, p_types text[], p_actor uuid)
returns table (
  key text, at timestamptz, type text, tags text[], actor_id uuid, actor_name text, actor_role text,
  unusual boolean, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select override_alert_threshold as threshold from public.studio_settings where id
  ),
  sale_rows as (
    select s.*, p.display_name, p.role,
      array_remove(array[
        'sales',
        case when exists (select 1 from public.sale_items i where i.sale_id = s.id and i.service_id is null) then 'custom' end,
        case when s.is_backdated then 'backdated' end,
        case when s.after_close then 'after_close' end], null) as tags
    from public.sales s
    left join public.profiles p on p.id = s.created_by
    where s.recorded_at < coalesce(p_before, 'infinity'::timestamptz)
      and s.recorded_at > coalesce(p_since, '-infinity'::timestamptz)
      and (p_actor is null or s.created_by = p_actor)
  ),
  sale_ev as (
    select 'sale:' || s.id as key, s.recorded_at as at, 'sale' as type, s.tags, s.created_by as actor_id,
      s.display_name as actor_name, s.role as actor_role,
      (s.is_backdated or s.after_close
       or exists (select 1 from public.owner_alerts a where a.sale_id = s.id and a.kind = 'large_override')) as unusual,
      jsonb_build_object(
        'sale_id', s.id, 'receipt_no', s.receipt_no, 'total', s.total, 'status', s.status, 'paid_at', s.paid_at,
        'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.item_name, 'quantity', i.quantity, 'staff', st.name,
                                                               'custom', i.service_id is null) order by i.line_no), '[]'::jsonb)
                  from public.sale_items i left join public.staff st on st.id = i.staff_id where i.sale_id = s.id),
        'methods', (select coalesce(jsonb_agg(distinct pm.method), '[]'::jsonb)
                    from public.sale_payments pm where pm.sale_id = s.id and pm.kind = 'payment')) as data
    from sale_rows s
    where p_types is null or s.tags && p_types
    order by s.recorded_at desc
    limit p_limit
  ),
  audit_rows as (
    select a.*,
      case
        when a.action = 'item_price_overridden' then 'overrides'
        when a.action = 'staff_reassigned' then 'reassignments'
        when a.action in ('item_price_changed', 'item_service_changed') then 'edits'
        when a.action in ('void_requested', 'void_request_approved', 'void_request_rejected', 'void_request_cancelled') then 'void_requests'
        when a.action = 'sale_voided' then 'voids'
        when a.action in ('appointment_cancelled', 'appointment_no_show') then 'appointments'
        when a.action in ('day_closed', 'day_reopened') then 'days'
      end as feed_type
    from public.audit_log a
    where a.action in ('item_price_overridden', 'staff_reassigned', 'item_price_changed', 'item_service_changed',
                       'void_requested', 'void_request_approved', 'void_request_rejected', 'void_request_cancelled',
                       'sale_voided', 'appointment_cancelled', 'appointment_no_show', 'day_closed', 'day_reopened')
      and a.created_at < coalesce(p_before, 'infinity'::timestamptz)
      and a.created_at > coalesce(p_since, '-infinity'::timestamptz)
      and (p_actor is null or a.actor_id = p_actor)
  ),
  audit_ev as (
    select 'audit:' || a.id as key, a.created_at as at, a.action as type, array[a.feed_type] as tags, a.actor_id,
      a.actor_name, a.actor_role,
      case
        when a.action = 'void_requested' then true
        when a.action = 'day_closed' then coalesce((a.after ->> 'cash_difference')::integer, 0) <> 0
        when a.action = 'item_price_overridden' then
          (select threshold from settings) > 0
          and abs(coalesce((a.before ->> 'list_price')::integer, 0) - coalesce((a.after ->> 'unit_price')::integer, 0))::bigint
              * coalesce((a.after ->> 'quantity')::integer, 1) > (select threshold from settings)
        else false
      end as unusual,
      jsonb_build_object('entity', a.entity, 'entity_id', a.entity_id, 'before', a.before, 'after', a.after, 'reason', a.reason) as data
    from audit_rows a
    where p_types is null or a.feed_type = any (p_types)
    order by a.created_at desc
    limit p_limit
  ),
  sign_in_ev as (
    select 'sign_in:' || e.id as key, e.signed_in_at as at, 'sign_in' as type, array['sign_ins'] as tags, e.profile_id as actor_id,
      p.display_name as actor_name, p.role as actor_role, false as unusual, '{}'::jsonb as data
    from public.sign_in_events e
    join public.profiles p on p.id = e.profile_id
    where p.role = 'counter'
      and e.signed_in_at < coalesce(p_before, 'infinity'::timestamptz)
      and e.signed_in_at > coalesce(p_since, '-infinity'::timestamptz)
      and (p_actor is null or e.profile_id = p_actor)
      and (p_types is null or 'sign_ins' = any (p_types))
    order by e.signed_in_at desc
    limit p_limit
  ),
  backup_ev as (
    select 'backup:' || b.id as key, b.created_at as at, 'backup_failed' as type, array['backups'] as tags, null::uuid as actor_id,
      null::text as actor_name, 'system' as actor_role, true as unusual,
      jsonb_build_object('kind', b.kind, 'message', left(b.message, 200)) as data
    from public.backup_runs b
    where b.status = 'failed'
      and b.created_at < coalesce(p_before, 'infinity'::timestamptz)
      and b.created_at > coalesce(p_since, '-infinity'::timestamptz)
      and p_actor is null
      and (p_types is null or 'backups' = any (p_types))
    order by b.created_at desc
    limit p_limit
  )
  select * from (
    select * from sale_ev
    union all select * from audit_ev
    union all select * from sign_in_ev
    union all select * from backup_ev
  ) ev
  order by ev.at desc, ev.key
  limit p_limit
$$;

-- The owner's feed, newest first, p_limit at a time (p_before = the time of
-- the last event shown, to load older ones). Pending void requests come
-- separately so the page can pin them at the top.
create or replace function public.activity_feed(
  p_before timestamptz default null, p_limit integer default 100, p_types text[] default null, p_actor uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_events jsonb;
  v_more boolean;
begin
  perform private.require_pos_user(array['owner']);
  select coalesce(jsonb_agg(to_jsonb(e) - 'rn' order by e.at desc, e.key) filter (where e.rn <= v_limit), '[]'::jsonb),
         count(*) > v_limit
    into v_events, v_more
    from (select e.*, row_number() over (order by e.at desc, e.key) as rn
          from private.activity_events(null, p_before, v_limit + 1, p_types, p_actor) e) e;

  return jsonb_build_object(
    'events', v_events,
    'has_more', v_more,
    'pending_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'sale_id', v.sale_id, 'receipt_no', s.receipt_no, 'total', s.total, 'reason', v.reason,
               'requested_by', p.display_name, 'requested_at', v.created_at) order by v.created_at)
      from public.void_requests v
      join public.sales s on s.id = v.sale_id
      left join public.profiles p on p.id = v.requested_by
      where v.status = 'pending'), '[]'::jsonb));
end;
$$;

-- Events since the owner last opened the feed, not counting their own (at
-- most 100; the sidebar shows "99+").
create or replace function public.activity_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_seen timestamptz;
begin
  select * into v_actor from private.require_pos_user(array['owner']);
  select activity_seen_at into v_seen from public.profiles where id = v_actor.user_id;
  return (select count(*) from private.activity_events(coalesce(v_seen, now() - interval '7 days'), null, 100, null, null) e
          where e.actor_id is distinct from v_actor.user_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Sending owner alerts (service role only: lib/alerts, never the browser)
-- -----------------------------------------------------------------------------

-- Decides every pending alert, oldest first, and returns the ones to send now
-- with the owner's phone. A claimed alert is marked failed with the note
-- 'Sending' until finish_owner_alert records the result, so an alert whose
-- sender died half-way reads as not confirmed, never as sent.
--   too old (6 hours)      -> skipped   (never sent late, for example after an outage)
--   kind switched off      -> disabled
--   no owner phone         -> skipped
--   daily cap reached      -> throttled (stays in the feed only)
create or replace function public.claim_owner_alerts(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.studio_settings;
  v_sent_today integer;
  v_alert public.owner_alerts;
  v_out jsonb := '[]'::jsonb;
begin
  -- One claimer at a time, so the daily count is exact.
  perform pg_advisory_xact_lock(hashtext('claim_owner_alerts'));
  select * into v_settings from public.studio_settings where id;

  update public.owner_alerts set sms_status = 'skipped', sms_error = 'Too old to send'
    where sms_status = 'pending' and created_at < now() - interval '6 hours';

  select count(*) into v_sent_today from public.owner_alerts
    where sms_sent_at >= private.accra_day_start(private.accra_today())
      and (sms_status = 'sent' or (sms_status = 'failed' and sms_error = 'Sending'));

  for v_alert in
    select * from public.owner_alerts where sms_status = 'pending'
    order by created_at, id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    for update skip locked
  loop
    if not coalesce((v_settings.alert_settings ->> v_alert.kind)::boolean, true) then
      update public.owner_alerts set sms_status = 'disabled' where id = v_alert.id;
    elsif v_settings.owner_alert_phone is null then
      update public.owner_alerts set sms_status = 'skipped', sms_error = 'No owner phone in Settings' where id = v_alert.id;
    elsif v_sent_today >= v_settings.daily_sms_cap then
      update public.owner_alerts set sms_status = 'throttled' where id = v_alert.id;
    else
      update public.owner_alerts set sms_status = 'failed', sms_error = 'Sending', sms_sent_at = now() where id = v_alert.id;
      v_sent_today := v_sent_today + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_alert.id,
        'kind', v_alert.kind,
        'payload', v_alert.payload,
        'phone', v_settings.owner_alert_phone,
        'created_at', v_alert.created_at,
        'sale', (select jsonb_build_object('receipt_no', s.receipt_no, 'total', s.total, 'business_date', s.business_date)
                 from public.sales s where s.id = v_alert.sale_id)));
    end if;
  end loop;
  return v_out;
end;
$$;

-- Records what happened to a claimed alert.
create or replace function public.finish_owner_alert(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.owner_alerts
    set sms_status = case when p_ok then 'sent' else 'failed' end,
        sms_error = case when p_ok then null else left(coalesce(nullif(trim(p_error), ''), 'Not sent'), 500) end,
        sms_sent_at = case when p_ok then now() end
    where id = p_id and sms_status = 'failed' and sms_error = 'Sending'
$$;

-- -----------------------------------------------------------------------------
-- 3. The 23:30 checks (service role only)
-- -----------------------------------------------------------------------------

-- For one business date: a day with paid sales but no active close queues
-- day_not_closed (with the day's figures); a day with paid sales but no
-- successful PC backup that day queues backup_stale. Each is keyed by the
-- date, so running the job twice queues nothing new.
create or replace function public.owner_daily_check(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_figures jsonb;
  v_sales integer;
  v_closed boolean;
  v_backup boolean;
begin
  if p_date is null or p_date > private.accra_today() then
    raise exception 'invalid_date' using detail = 'Choose today or an earlier day.';
  end if;
  v_figures := private.day_figures(p_date) - 'per_staff';
  v_sales := (v_figures ->> 'sales_count')::integer;
  v_closed := private.is_day_closed(p_date);
  v_backup := exists (
    select 1 from public.backup_runs b
    where b.kind = 'daily_pc' and b.status = 'success'
      and b.created_at >= private.accra_day_start(p_date) and b.created_at < private.accra_day_start(p_date + 1));

  if v_sales > 0 and not v_closed then
    perform private.create_owner_alert('day_not_closed', null,
      v_figures || jsonb_build_object('business_date', p_date), 'day_not_closed:' || p_date::text);
  end if;
  if v_sales > 0 and not v_backup then
    perform private.create_owner_alert('backup_stale', null, jsonb_build_object(
      'business_date', p_date,
      'last_backup_at', (select max(b.created_at) from public.backup_runs b where b.kind = 'daily_pc' and b.status = 'success')),
      'backup_stale:' || p_date::text);
  end if;

  return jsonb_build_object(
    'business_date', p_date, 'sales_count', v_sales, 'closed', v_closed, 'backup_ok', v_backup,
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object('kind', a.kind, 'sms_status', a.sms_status) order by a.kind)
      from public.owner_alerts a
      where a.occurrence_key in ('day_not_closed:' || p_date::text, 'backup_stale:' || p_date::text)), '[]'::jsonb));
end;
$$;

revoke execute on function private.activity_events(timestamptz, timestamptz, integer, text[], uuid) from public, anon, authenticated;
revoke execute on function public.activity_feed(timestamptz, integer, text[], uuid) from public, anon;
revoke execute on function public.activity_unread_count() from public, anon;
grant execute on function public.activity_feed(timestamptz, integer, text[], uuid) to authenticated;
grant execute on function public.activity_unread_count() to authenticated;

revoke execute on function public.claim_owner_alerts(integer) from public, anon, authenticated;
revoke execute on function public.finish_owner_alert(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.owner_daily_check(date) from public, anon, authenticated;
grant execute on function public.claim_owner_alerts(integer) to service_role;
grant execute on function public.finish_owner_alert(uuid, boolean, text) to service_role;
grant execute on function public.owner_daily_check(date) to service_role;
