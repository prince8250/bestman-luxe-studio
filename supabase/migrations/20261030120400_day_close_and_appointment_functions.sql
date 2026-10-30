-- =============================================================================
-- Close day (cash-up) and appointments.
-- =============================================================================

-- Money and work totals for one business day (paid sales only).
create or replace function private.day_figures(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with day_sales as (
    select s.id, s.total from public.sales s where s.business_date = p_date and s.status = 'paid'
  ),
  by_method as (
    select p.method, sum(p.amount)::bigint as amount
    from public.sale_payments p join day_sales d on d.id = p.sale_id
    group by p.method
  ),
  per_staff as (
    select i.staff_id, st.name as staff_name, sum(i.quantity)::bigint as services
    from public.sale_items i
    join day_sales d on d.id = i.sale_id
    left join public.staff st on st.id = i.staff_id
    where i.service_id is not null
    group by i.staff_id, st.name
  )
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from day_sales), 0),
    'sales_count', (select count(*) from day_sales),
    'services_count', coalesce((select sum(i.quantity) from public.sale_items i join day_sales d on d.id = i.sale_id where i.service_id is not null), 0),
    'cash', coalesce((select amount from by_method where method = 'cash'), 0),
    'momo', coalesce((select amount from by_method where method = 'momo'), 0),
    'card', coalesce((select amount from by_method where method = 'card'), 0),
    'other', coalesce((select amount from by_method where method = 'other'), 0),
    'voids_count', (select count(*) from public.sales s where s.business_date = p_date and s.status = 'voided'),
    'pending_void_requests', (select count(*) from public.void_requests v join public.sales s on s.id = v.sale_id
                              where s.business_date = p_date and v.status = 'pending'),
    'per_staff', coalesce((select jsonb_agg(jsonb_build_object('staff_id', staff_id, 'staff_name', staff_name, 'services', services)
                                            order by services desc, staff_name) from per_staff), '[]'::jsonb)
  )
$$;

-- -----------------------------------------------------------------------------
-- close_day: the POS user enters the cash they counted BEFORE seeing what the
-- system expects (a blind count). Expected cash is computed here, on the
-- server only: opening float + cash payment rows of that day's paid sales
-- (refund adjustments are negative rows).
-- -----------------------------------------------------------------------------
create or replace function public.close_day(
  p_business_date date,
  p_counted_cash integer,
  p_momo_reported integer,
  p_opening_float integer,
  p_note text,
  p_opening_float_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_settings public.studio_settings;
  v_float integer;
  v_float_reason text := nullif(trim(p_opening_float_reason), '');
  v_figures jsonb;
  v_expected_cash integer;
  v_difference integer;
  v_close public.day_closes;
begin
  select * into v_actor from private.require_pos_user(array['owner', 'counter']);
  select * into v_settings from public.studio_settings where id;

  if p_business_date is null or p_business_date > private.accra_today() then
    raise exception 'invalid_date' using detail = 'Choose today or an earlier day.';
  end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'invalid_amount' using detail = 'Enter the cash you counted.';
  end if;
  if p_momo_reported is not null and p_momo_reported < 0 then
    raise exception 'invalid_amount' using detail = 'The MoMo total cannot be negative.';
  end if;

  v_float := coalesce(p_opening_float, v_settings.default_opening_float);
  if v_float < 0 then
    raise exception 'invalid_amount' using detail = 'The opening float cannot be negative.';
  end if;
  if v_float <> v_settings.default_opening_float and v_float_reason is null then
    raise exception 'float_reason_required' using detail = 'Say why the opening float is different today.';
  end if;

  -- One close at a time per day, even if two people press Close together.
  perform pg_advisory_xact_lock(hashtext('close_day:' || p_business_date::text));
  if private.is_day_closed(p_business_date) then
    raise exception 'already_closed' using detail = 'This day is already closed. The owner can reopen it.';
  end if;

  v_figures := private.day_figures(p_business_date);
  v_expected_cash := v_float + (v_figures ->> 'cash')::integer;
  v_difference := p_counted_cash - v_expected_cash;

  insert into public.day_closes (
    business_date, opening_float, opening_float_reason, expected_cash, counted_cash, cash_difference,
    momo_reported, expected_momo, expected_card, expected_other, sales_count, note, closed_by)
  values (
    p_business_date, v_float, v_float_reason, v_expected_cash, p_counted_cash, v_difference,
    p_momo_reported, (v_figures ->> 'momo')::integer, (v_figures ->> 'card')::integer,
    (v_figures ->> 'other')::integer, (v_figures ->> 'sales_count')::integer,
    left(nullif(trim(p_note), ''), 500), v_actor.user_id)
  returning * into v_close;

  v_figures := v_figures || jsonb_build_object(
    'day_close_id', v_close.id,
    'business_date', p_business_date,
    'opening_float', v_float,
    'expected_cash', v_expected_cash,
    'counted_cash', p_counted_cash,
    'cash_difference', v_difference,
    'momo_reported', p_momo_reported,
    'closed_at', v_close.closed_at,
    'closed_by', v_actor.user_name);

  perform private.write_audit('day_close', v_close.id, 'day_closed', null,
    jsonb_build_object('business_date', p_business_date, 'expected_cash', v_expected_cash,
                       'counted_cash', p_counted_cash, 'cash_difference', v_difference),
    p_note);
  perform private.create_owner_alert('day_summary', null, v_figures - 'per_staff', 'day_summary:' || v_close.id::text);
  if abs(v_difference) > v_settings.cash_difference_tolerance then
    perform private.create_owner_alert('cash_difference', null, jsonb_build_object(
      'business_date', p_business_date, 'expected_cash', v_expected_cash,
      'counted_cash', p_counted_cash, 'cash_difference', v_difference, 'by', v_actor.user_name),
      'cash_difference:' || v_close.id::text);
  end if;

  return v_figures;
end;
$$;

-- Owner only: reopen a closed day (the close stays in history).
create or replace function public.reopen_day(p_business_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_reason text := nullif(trim(p_reason), '');
  v_close_id uuid;
begin
  select * into v_actor from private.require_pos_user(array['owner']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for reopening the day.';
  end if;
  update public.day_closes
    set reopened_by = v_actor.user_id, reopened_at = now(), reopen_reason = left(v_reason, 300)
    where business_date = p_business_date and reopened_at is null
    returning id into v_close_id;
  if v_close_id is null then
    raise exception 'not_closed' using detail = 'This day is not closed.';
  end if;
  perform private.write_audit('day_close', v_close_id, 'day_reopened', null,
    jsonb_build_object('business_date', p_business_date), v_reason);
end;
$$;

-- -----------------------------------------------------------------------------
-- Appointments
-- -----------------------------------------------------------------------------

-- Short booking code like BK-7K4Q, without look-alike characters (0/O, 1/I/L).
create or replace function private.generate_booking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_code text := 'BK-';
  i integer;
begin
  for i in 0..3 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_appointment(payload): callable by the service role only, from the
-- public booking server action (after Turnstile and rate limits, spec 34) or
-- from the POS phone-booking action (after its permission check).
--
-- payload:
-- {
--   "service_id": uuid, "staff_id": uuid,           -- staff already chosen ("any" resolved by the server)
--   "staff_preference": "specific" | "any",
--   "starts_at": timestamptz,
--   "customer_phone": "+233...", "customer_name": "Ama",
--   "source": "web" | "phone",
--   "notes": text, "created_by": uuid (phone bookings)
-- }
-- The overlap constraint is the final guard: a lost race raises 'slot_taken'.
-- -----------------------------------------------------------------------------
create or replace function public.create_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.studio_settings;
  v_service public.services;
  v_staff public.staff;
  v_service_id uuid;
  v_staff_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_source text := payload ->> 'source';
  v_preference text := coalesce(payload ->> 'staff_preference', 'specific');
  v_phone text := nullif(trim(payload ->> 'customer_phone'), '');
  v_name text := nullif(trim(payload ->> 'customer_name'), '');
  v_created_by uuid;
  v_customer public.customers;
  v_appointment public.appointments;
  v_attempt integer := 0;
begin
  select * into v_settings from public.studio_settings where id;

  begin
    v_service_id := (payload ->> 'service_id')::uuid;
    v_staff_id := (payload ->> 'staff_id')::uuid;
    v_starts_at := (payload ->> 'starts_at')::timestamptz;
    v_created_by := nullif(payload ->> 'created_by', '')::uuid;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'invalid_input' using detail = 'An id or the time in the booking is not valid.';
  end;
  if v_service_id is null or v_staff_id is null or v_starts_at is null then
    raise exception 'invalid_input' using detail = 'Service, staff, and time are required.';
  end if;
  if v_source is null or v_source not in ('web', 'phone') then
    raise exception 'invalid_input' using detail = 'source must be web or phone.';
  end if;
  if v_preference not in ('specific', 'any') then
    raise exception 'invalid_input' using detail = 'staff_preference must be specific or any.';
  end if;
  if v_phone is null or not private.is_e164(v_phone) then
    raise exception 'invalid_phone' using detail = 'The phone number is not valid.';
  end if;
  if v_name is null or length(v_name) > 80 then
    raise exception 'invalid_name' using detail = 'A name is required.';
  end if;

  select * into v_service from public.services where id = v_service_id;
  if not found or not v_service.active
     or (v_source = 'web' and not (v_service.bookable_online and v_service.show_on_website)) then
    raise exception 'service_unavailable' using detail = 'This service cannot be booked.';
  end if;
  select * into v_staff from public.staff where id = v_staff_id;
  if not found or not v_staff.active
     or (v_source = 'web' and not (
          v_staff.bookable_online
          and exists (select 1 from public.service_staff ss where ss.service_id = v_service_id and ss.staff_id = v_staff_id))) then
    raise exception 'staff_unavailable' using detail = 'This staff member cannot take this booking.';
  end if;

  if v_source = 'web' and v_starts_at < now() + make_interval(mins => v_settings.booking_lead_minutes) then
    raise exception 'too_soon' using detail = 'This time is too soon to book online.';
  end if;
  if v_starts_at < now() - interval '15 minutes' then
    raise exception 'in_the_past' using detail = 'This time has already passed.';
  end if;
  v_ends_at := v_starts_at + make_interval(mins => v_service.duration_minutes);

  insert into public.customers (phone, full_name)
  values (v_phone, v_name)
  on conflict (phone) do update set full_name = coalesce(public.customers.full_name, excluded.full_name)
  returning * into v_customer;

  if v_source = 'web' then
    if v_customer.blocked then
      raise exception 'customer_blocked' using detail = 'Online booking is not available. Please call the studio.';
    end if;
    if (select count(*) from public.appointments a
        where a.customer_id = v_customer.id and a.status = 'confirmed' and a.starts_at > now())
       >= v_settings.max_upcoming_per_phone then
      raise exception 'too_many_upcoming' using detail = 'Please call the studio to book more appointments.';
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.appointments (
        code, public_token, customer_id, customer_name, customer_phone, service_id, staff_id,
        staff_preference, starts_at, ends_at, status, source, quoted_price, notes, created_by)
      values (
        private.generate_booking_code(), encode(extensions.gen_random_bytes(24), 'hex'),
        v_customer.id, v_name, v_phone, v_service_id, v_staff_id,
        v_preference, v_starts_at, v_ends_at, 'confirmed', v_source, v_service.price,
        left(nullif(trim(payload ->> 'notes'), ''), 500), v_created_by)
      returning * into v_appointment;
      exit;
    exception
      when exclusion_violation then
        raise exception 'slot_taken' using detail = 'That time was just taken. Please choose another time.';
      when unique_violation then
        -- A booking code collision (rare): try a new code.
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;

  perform private.write_audit('appointment', v_appointment.id, 'appointment_created', null,
    jsonb_build_object('code', v_appointment.code, 'service', v_service.name, 'staff', v_staff.name,
                       'starts_at', v_starts_at, 'source', v_source),
    null,
    case when v_source = 'web' then 'public' end);

  return jsonb_build_object(
    'appointment_id', v_appointment.id, 'code', v_appointment.code,
    'public_token', v_appointment.public_token, 'starts_at', v_starts_at, 'ends_at', v_ends_at,
    'staff_id', v_staff_id, 'quoted_price', v_service.price);
end;
$$;

-- POS: cancel a confirmed appointment (frees the slot).
create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_reason text := nullif(trim(p_reason), '');
  v_appointment public.appointments;
begin
  select * into v_actor from private.require_pos_user(array['owner', 'counter']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for cancelling.';
  end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That appointment was not found.';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'appointment_not_open' using detail = 'Only confirmed appointments can be cancelled.';
  end if;
  update public.appointments
    set status = 'cancelled', cancel_reason = left(v_reason, 300), cancelled_by = v_actor.user_id, cancelled_at = now()
    where id = p_appointment_id;
  perform private.write_audit('appointment', p_appointment_id, 'appointment_cancelled',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'cancelled', 'code', v_appointment.code, 'starts_at', v_appointment.starts_at),
    v_reason);
end;
$$;

-- POS: the customer did not come (only once the start time has passed).
create or replace function public.mark_no_show(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_appointment public.appointments;
begin
  select * into v_actor from private.require_pos_user(array['owner', 'counter']);
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That appointment was not found.';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'appointment_not_open' using detail = 'Only confirmed appointments can be marked as no-show.';
  end if;
  if v_appointment.starts_at > now() then
    raise exception 'too_early' using detail = 'An appointment can be marked no-show only after its start time.';
  end if;
  update public.appointments set status = 'no_show' where id = p_appointment_id;
  perform private.write_audit('appointment', p_appointment_id, 'appointment_no_show',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'no_show', 'code', v_appointment.code, 'customer_phone', v_appointment.customer_phone));
end;
$$;
