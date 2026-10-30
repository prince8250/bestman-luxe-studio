-- =============================================================================
-- Sale functions. Each one is a single transaction (like a Spring
-- @Transactional service method that lives inside the database): either every
-- row is written, or none is.
--
-- They are called from server actions with supabase.rpc() AFTER the server
-- action has validated input and checked the permission. They check the
-- caller's role again here, so calling the database directly cannot skip the
-- rules in architecture-context.md ("Permissions").
--
-- Errors are raised with a stable snake_case message (for example
-- 'discount_limit') that the app maps to a plain-language message.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_sale(payload)
--
-- payload:
-- {
--   "client_request_id": uuid,              -- required; repeat calls return the first sale
--   "customer_phone": "+233...",            -- optional, E.164
--   "customer_name": "Ama",                 -- optional
--   "appointment_id": uuid,                 -- optional (Start sale from an appointment)
--   "paid_at": timestamptz,                 -- optional; only for "Record a past sale"
--   "note": text,                           -- optional
--   "items": [{ "service_id": uuid | null, "item_name": text (custom only),
--               "staff_id": uuid | null, "unit_price": int, "quantity": int,
--               "price_override_reason": text }],
--   "payments": [{ "method": "cash"|"momo"|"card"|"other", "amount": int,
--                  "tendered": int (cash only), "reference": text }]
-- }
--
-- Prices are re-read from public.services here. unit_price is only the price
-- the counter typed; it is checked against the service price and the caller's
-- discount limit.
-- -----------------------------------------------------------------------------
create or replace function public.create_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_settings public.studio_settings;
  v_request_id uuid;
  v_existing public.sales;
  v_paid_at timestamptz;
  v_is_backdated boolean := false;
  v_limit_days integer;
  v_after_close boolean;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_appointment public.appointments;
  v_appointment_id uuid;
  v_channel text := 'walk_in';
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_line_no integer := 0;
  v_service public.services;
  v_service_id uuid;
  v_staff_id uuid;
  v_list integer;
  v_unit integer;
  v_qty integer;
  v_reason text;
  v_name text;
  v_duration integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_total integer := 0;
  v_paid integer := 0;
  v_payment jsonb;
  v_method text;
  v_amount integer;
  v_tendered integer;
  v_sale_id uuid;
  v_receipt_no text;
  v_item_id uuid;
  v_overrides jsonb := '[]'::jsonb;
  v_large_override boolean := false;
begin
  select * into v_actor from private.require_pos_user(array['owner', 'counter']);
  select * into v_settings from public.studio_settings where id;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid_input' using detail = 'The sale payload must be a JSON object.';
  end if;

  begin
    v_request_id := (payload ->> 'client_request_id')::uuid;
    v_appointment_id := nullif(payload ->> 'appointment_id', '')::uuid;
    v_paid_at := nullif(payload ->> 'paid_at', '')::timestamptz;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'invalid_input' using detail = 'An id or a date in the sale is not valid.';
  end;
  if v_request_id is null then
    raise exception 'invalid_input' using detail = 'client_request_id is required.';
  end if;

  -- A repeated call (double click, retry after a network error) returns the
  -- sale that was already created instead of creating a second one.
  select * into v_existing from public.sales where client_request_id = v_request_id;
  if found then
    return jsonb_build_object(
      'sale_id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'total', v_existing.total,
      'existing', true, 'is_backdated', v_existing.is_backdated, 'after_close', v_existing.after_close);
  end if;

  -- Time of the sale. A past time means "Record a past sale" (paper sales
  -- written during an outage): limited by role, never in the future.
  if v_paid_at is null then
    v_paid_at := now();
  else
    if v_paid_at > now() + interval '2 minutes' then
      raise exception 'future_time' using detail = 'A sale cannot be recorded in the future.';
    end if;
    v_limit_days := case v_actor.user_role when 'owner' then 14 else v_settings.counter_backdate_days end;
    if private.accra_date(v_paid_at) < private.accra_today() - v_limit_days then
      raise exception 'backdate_limit'
        using detail = format('This account can record past sales up to %s days back.', v_limit_days);
    end if;
    v_is_backdated := true;
  end if;

  -- Lines.
  if jsonb_typeof(payload -> 'items') is distinct from 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'no_items' using detail = 'A sale needs at least one line.';
  end if;
  if jsonb_array_length(payload -> 'items') > 30 then
    raise exception 'too_many_items' using detail = 'A sale can have at most 30 lines.';
  end if;

  for v_item in select value from jsonb_array_elements(payload -> 'items') loop
    v_line_no := v_line_no + 1;
    begin
      v_service_id := nullif(v_item ->> 'service_id', '')::uuid;
      v_staff_id := nullif(v_item ->> 'staff_id', '')::uuid;
      v_unit := (v_item ->> 'unit_price')::integer;
      v_qty := coalesce((v_item ->> 'quantity')::integer, 1);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_input' using detail = format('Line %s has an invalid value.', v_line_no);
    end;
    v_reason := nullif(trim(v_item ->> 'price_override_reason'), '');

    if v_qty < 1 or v_qty > 20 then
      raise exception 'invalid_quantity' using detail = format('Line %s: quantity must be 1 to 20.', v_line_no);
    end if;
    if v_unit is null or v_unit < 0 then
      raise exception 'invalid_price' using detail = format('Line %s: the price is missing or negative.', v_line_no);
    end if;

    if v_service_id is not null then
      select * into v_service from public.services where id = v_service_id;
      if not found or not v_service.active then
        raise exception 'service_unavailable' using detail = format('Line %s: this service is not available.', v_line_no);
      end if;
      if v_staff_id is null then
        raise exception 'staff_required' using detail = format('Line %s: choose who did the work.', v_line_no);
      end if;
      v_list := v_service.price;
      v_name := v_service.name;
      v_duration := v_service.duration_minutes;
    else
      -- Custom item: free-text name and price (an occasional product or extra).
      v_name := nullif(trim(v_item ->> 'item_name'), '');
      if v_name is null or length(v_name) > 80 then
        raise exception 'custom_item_name_required' using detail = format('Line %s: a custom item needs a name.', v_line_no);
      end if;
      if v_actor.user_role = 'counter' and v_reason is null then
        raise exception 'custom_item_reason_required' using detail = format('Line %s: a custom item needs a reason.', v_line_no);
      end if;
      v_list := v_unit;
      v_duration := 0;
    end if;

    if v_staff_id is not null and not exists (select 1 from public.staff where id = v_staff_id and active) then
      raise exception 'staff_unavailable' using detail = format('Line %s: this staff member is not available.', v_line_no);
    end if;

    -- Price override rules (architecture-context.md, "Permissions").
    if v_unit <> v_list then
      if v_reason is null then
        raise exception 'override_reason_required' using detail = format('Line %s: a changed price needs a reason.', v_line_no);
      end if;
      if v_actor.user_role = 'counter' and v_unit < v_list
         and (v_list - v_unit)::bigint * 100 > v_list::bigint * v_settings.max_counter_discount_percent then
        raise exception 'discount_limit'
          using detail = format('Discounts above %s%% need the owner.', v_settings.max_counter_discount_percent);
      end if;
      v_overrides := v_overrides || jsonb_build_array(jsonb_build_object(
        'line_no', v_line_no, 'item_name', v_name, 'list_price', v_list,
        'unit_price', v_unit, 'quantity', v_qty, 'reason', v_reason));
      if v_settings.override_alert_threshold > 0
         and abs(v_list - v_unit)::bigint * v_qty > v_settings.override_alert_threshold then
        v_large_override := true;
      end if;
    end if;

    v_total := v_total + v_unit * v_qty;
    v_discount := v_discount + greatest(v_list - v_unit, 0) * v_qty;
    v_subtotal := v_subtotal + greatest(v_list, v_unit) * v_qty;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_no', v_line_no, 'service_id', v_service_id, 'item_name', v_name, 'staff_id', v_staff_id,
      'list_price', v_list, 'unit_price', v_unit, 'quantity', v_qty,
      'reason', case when v_unit <> v_list or v_service_id is null then v_reason end,
      'duration_minutes', v_duration));
  end loop;

  -- Payments must add up to the total exactly.
  if jsonb_typeof(coalesce(payload -> 'payments', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input' using detail = 'payments must be a list.';
  end if;
  if jsonb_array_length(coalesce(payload -> 'payments', '[]'::jsonb)) > 4 then
    raise exception 'too_many_payments' using detail = 'A sale can be split across at most 4 payments.';
  end if;
  for v_payment in select value from jsonb_array_elements(coalesce(payload -> 'payments', '[]'::jsonb)) loop
    v_method := v_payment ->> 'method';
    begin
      v_amount := (v_payment ->> 'amount')::integer;
      v_tendered := (v_payment ->> 'tendered')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_input' using detail = 'A payment amount is not valid.';
    end;
    if v_method is null or v_method not in ('cash', 'momo', 'card', 'other') then
      raise exception 'invalid_payment_method' using detail = 'Payment method must be cash, MoMo, card, or other.';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_payment_amount' using detail = 'Each payment must be more than zero.';
    end if;
    if v_tendered is not null and (v_method <> 'cash' or v_tendered < v_amount) then
      raise exception 'invalid_tendered' using detail = 'Cash tendered must be at least the cash amount.';
    end if;
    v_paid := v_paid + v_amount;
  end loop;
  if v_paid <> v_total then
    raise exception 'payments_mismatch'
      using detail = format('Payments add up to %s but the total is %s.', v_paid, v_total);
  end if;

  -- Appointment being turned into a sale (Start sale).
  v_customer_phone := nullif(trim(payload ->> 'customer_phone'), '');
  v_customer_name := nullif(trim(payload ->> 'customer_name'), '');
  if v_appointment_id is not null then
    select * into v_appointment from public.appointments where id = v_appointment_id for update;
    if not found then
      raise exception 'appointment_not_found' using detail = 'The appointment was not found.';
    end if;
    if v_appointment.status <> 'confirmed' or v_appointment.sale_id is not null then
      raise exception 'appointment_not_open' using detail = 'This appointment was already paid, cancelled, or marked no-show.';
    end if;
    v_channel := case v_appointment.source when 'web' then 'online_booking' else 'phone_booking' end;
    v_customer_phone := coalesce(v_customer_phone, v_appointment.customer_phone);
    v_customer_name := coalesce(v_customer_name, v_appointment.customer_name);
  end if;

  -- Customer: one row per phone. An existing customer keeps their saved name.
  -- Blocked numbers can still buy at the counter (blocking is for online booking).
  if v_customer_phone is not null then
    if not private.is_e164(v_customer_phone) then
      raise exception 'invalid_phone' using detail = 'The phone number is not valid.';
    end if;
    insert into public.customers (phone, full_name)
    values (v_customer_phone, left(v_customer_name, 80))
    on conflict (phone) do update
      set full_name = coalesce(public.customers.full_name, excluded.full_name)
    returning id, full_name into v_customer_id, v_customer_name;
  end if;

  v_after_close := private.is_day_closed(private.accra_date(v_paid_at));

  begin
    insert into public.sales (
      customer_id, customer_name, customer_phone, appointment_id, channel, status,
      subtotal, discount_total, total, paid_at, recorded_at, is_backdated, after_close,
      created_by, note, client_request_id)
    values (
      v_customer_id, v_customer_name, v_customer_phone, v_appointment_id, v_channel, 'paid',
      v_subtotal, v_discount, v_total, v_paid_at, now(), v_is_backdated, v_after_close,
      v_actor.user_id, left(nullif(trim(payload ->> 'note'), ''), 500), v_request_id)
    returning id, receipt_no into v_sale_id, v_receipt_no;
  exception when unique_violation then
    -- Two identical requests at the same moment: the other one won.
    select * into v_existing from public.sales where client_request_id = v_request_id;
    if found then
      return jsonb_build_object(
        'sale_id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'total', v_existing.total,
        'existing', true, 'is_backdated', v_existing.is_backdated, 'after_close', v_existing.after_close);
    end if;
    raise;
  end;

  for v_line in select value from jsonb_array_elements(v_lines) loop
    insert into public.sale_items (
      sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price, quantity,
      line_total, price_override_reason, duration_minutes)
    values (
      v_sale_id, (v_line ->> 'line_no')::smallint, nullif(v_line ->> 'service_id', '')::uuid,
      v_line ->> 'item_name', nullif(v_line ->> 'staff_id', '')::uuid,
      (v_line ->> 'list_price')::integer, (v_line ->> 'unit_price')::integer, (v_line ->> 'quantity')::smallint,
      (v_line ->> 'unit_price')::integer * (v_line ->> 'quantity')::integer,
      v_line ->> 'reason', (v_line ->> 'duration_minutes')::integer)
    returning id into v_item_id;

    if (v_line ->> 'unit_price')::integer <> (v_line ->> 'list_price')::integer then
      perform private.write_audit('sale_item', v_item_id, 'item_price_overridden',
        jsonb_build_object('list_price', (v_line ->> 'list_price')::integer),
        jsonb_build_object('unit_price', (v_line ->> 'unit_price')::integer,
                           'quantity', (v_line ->> 'quantity')::integer,
                           'item_name', v_line ->> 'item_name',
                           'sale_id', v_sale_id, 'receipt_no', v_receipt_no),
        v_line ->> 'reason');
    end if;
  end loop;

  for v_payment in select value from jsonb_array_elements(coalesce(payload -> 'payments', '[]'::jsonb)) loop
    insert into public.sale_payments (sale_id, kind, method, amount, tendered, reference, created_by)
    values (
      v_sale_id, 'payment', v_payment ->> 'method', (v_payment ->> 'amount')::integer,
      (v_payment ->> 'tendered')::integer, left(nullif(trim(v_payment ->> 'reference'), ''), 60), v_actor.user_id);
  end loop;

  if v_appointment_id is not null then
    update public.appointments
      set status = 'arrived', sale_id = v_sale_id
      where id = v_appointment_id;
  end if;

  if v_is_backdated then
    perform private.write_audit('sale', v_sale_id, 'sale_backdated', null,
      jsonb_build_object('receipt_no', v_receipt_no, 'paid_at', v_paid_at, 'total', v_total));
    perform private.create_owner_alert('backdated_sale', v_sale_id, jsonb_build_object(
      'receipt_no', v_receipt_no, 'paid_at', v_paid_at, 'total', v_total, 'by', v_actor.user_name));
  end if;
  if v_large_override then
    perform private.create_owner_alert('large_override', v_sale_id, jsonb_build_object(
      'receipt_no', v_receipt_no, 'lines', v_overrides, 'by', v_actor.user_name));
  end if;
  if v_after_close then
    perform private.create_owner_alert('after_close_sale', v_sale_id, jsonb_build_object(
      'receipt_no', v_receipt_no, 'total', v_total, 'business_date', private.accra_date(v_paid_at),
      'by', v_actor.user_name));
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id, 'receipt_no', v_receipt_no, 'total', v_total,
    'existing', false, 'is_backdated', v_is_backdated, 'after_close', v_after_close);
end;
$$;

-- -----------------------------------------------------------------------------
-- reassign_sale_item_staff: change who did the work on one line.
-- Counter: same business day only. Owner: any time. Reason always required.
-- Never changes the total, the receipt number, or the payments.
-- -----------------------------------------------------------------------------
create or replace function public.reassign_sale_item_staff(p_item_id uuid, p_new_staff_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_item public.sale_items;
  v_sale public.sales;
  v_old_name text;
  v_new_name text;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v_actor from private.require_pos_user(array['owner', 'counter']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for changing the staff member.';
  end if;

  select * into v_item from public.sale_items where id = p_item_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That sale line was not found.';
  end if;
  select * into v_sale from public.sales where id = v_item.sale_id for update;
  if v_sale.status = 'voided' then
    raise exception 'sale_voided' using detail = 'This sale was voided.';
  end if;
  if v_actor.user_role = 'counter' and v_sale.business_date <> private.accra_today() then
    raise exception 'reassign_window' using detail = 'Only today''s sales can be changed at the counter. Ask the owner.';
  end if;
  if p_new_staff_id is null then
    raise exception 'staff_required' using detail = 'Choose the staff member who did the work.';
  end if;
  select name into v_new_name from public.staff where id = p_new_staff_id and active;
  if not found then
    raise exception 'staff_unavailable' using detail = 'That staff member is not available.';
  end if;
  if v_item.staff_id is not distinct from p_new_staff_id then
    raise exception 'no_change' using detail = 'That staff member is already on this line.';
  end if;
  select name into v_old_name from public.staff where id = v_item.staff_id;

  update public.sale_items set staff_id = p_new_staff_id where id = p_item_id;
  update public.sales set updated_at = now() where id = v_sale.id;

  perform private.write_audit('sale_item', p_item_id, 'staff_reassigned',
    jsonb_build_object('staff_id', v_item.staff_id, 'staff_name', v_old_name,
                       'sale_id', v_sale.id, 'receipt_no', v_sale.receipt_no, 'item_name', v_item.item_name),
    jsonb_build_object('staff_id', p_new_staff_id, 'staff_name', v_new_name),
    v_reason);
end;
$$;

-- Recomputes a sale's subtotal, discount, and total from its lines.
create or replace function private.recompute_sale_totals(p_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_discount integer;
begin
  select coalesce(sum(line_total), 0), coalesce(sum(greatest(list_price - unit_price, 0) * quantity), 0)
    into v_total, v_discount
    from public.sale_items where sale_id = p_sale_id;
  update public.sales
    set total = v_total, discount_total = v_discount, subtotal = v_total + v_discount
    where id = p_sale_id;
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- edit_sale_item (owner only): change a paid line's service, price, or
-- quantity, with a reason. If the line total changes, the money difference is
-- recorded in the same step (p_payment_adjustment: {"method", "amount",
-- "reference"}; amount = new line total - old line total, negative = refund),
-- so the payments still equal the total.
-- p_changes: {"service_id": uuid, "unit_price": int, "quantity": int}
-- -----------------------------------------------------------------------------
create or replace function public.edit_sale_item(
  p_item_id uuid,
  p_changes jsonb,
  p_payment_adjustment jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_item public.sale_items;
  v_sale public.sales;
  v_service public.services;
  v_reason text := nullif(trim(p_reason), '');
  v_service_id uuid;
  v_name text;
  v_list integer;
  v_unit integer;
  v_qty integer;
  v_duration integer;
  v_delta integer;
  v_method text;
  v_amount integer;
  v_new_total integer;
  v_service_changed boolean;
  v_price_changed boolean;
begin
  select * into v_actor from private.require_pos_user(array['owner']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for the change.';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid_input' using detail = 'Nothing to change.';
  end if;

  select * into v_item from public.sale_items where id = p_item_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That sale line was not found.';
  end if;
  select * into v_sale from public.sales where id = v_item.sale_id for update;
  if v_sale.status = 'voided' then
    raise exception 'sale_voided' using detail = 'This sale was voided.';
  end if;

  begin
    v_service_id := case when p_changes ? 'service_id' then nullif(p_changes ->> 'service_id', '')::uuid else v_item.service_id end;
    v_unit := (p_changes ->> 'unit_price')::integer;
    v_qty := coalesce((p_changes ->> 'quantity')::integer, v_item.quantity);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_input' using detail = 'A changed value is not valid.';
  end;

  v_service_changed := v_service_id is distinct from v_item.service_id;
  if v_service_changed then
    if v_service_id is null then
      raise exception 'invalid_input' using detail = 'A service line cannot become a custom item.';
    end if;
    select * into v_service from public.services where id = v_service_id;
    if not found then
      raise exception 'service_unavailable' using detail = 'That service was not found.';
    end if;
    if v_item.staff_id is null then
      raise exception 'staff_required' using detail = 'Choose who did the work before changing the service.';
    end if;
    v_name := v_service.name;
    v_list := v_service.price;
    v_duration := v_service.duration_minutes;
    v_unit := coalesce(v_unit, v_service.price);
  else
    v_name := v_item.item_name;
    v_duration := v_item.duration_minutes;
    v_unit := coalesce(v_unit, v_item.unit_price);
    -- A custom item's "list price" is whatever it is now charged at.
    v_list := case when v_item.service_id is null then v_unit else v_item.list_price end;
  end if;

  if v_unit < 0 then
    raise exception 'invalid_price' using detail = 'The price cannot be negative.';
  end if;
  if v_qty < 1 or v_qty > 20 then
    raise exception 'invalid_quantity' using detail = 'Quantity must be 1 to 20.';
  end if;

  v_price_changed := v_unit <> v_item.unit_price or v_qty <> v_item.quantity;
  if not v_service_changed and not v_price_changed then
    raise exception 'no_change' using detail = 'Nothing was changed.';
  end if;

  v_delta := v_unit * v_qty - v_item.line_total;

  -- The money difference must be recorded so payments still equal the total.
  if v_delta <> 0 then
    if p_payment_adjustment is null or jsonb_typeof(p_payment_adjustment) <> 'object' then
      raise exception 'adjustment_required'
        using detail = format('The total changes by %s. Record the money collected or refunded.', v_delta);
    end if;
    v_method := p_payment_adjustment ->> 'method';
    begin
      v_amount := (p_payment_adjustment ->> 'amount')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_input' using detail = 'The adjustment amount is not valid.';
    end;
    if v_method is null or v_method not in ('cash', 'momo', 'card', 'other') then
      raise exception 'invalid_payment_method' using detail = 'Choose how the difference was paid or refunded.';
    end if;
    if v_amount is distinct from v_delta then
      raise exception 'adjustment_mismatch'
        using detail = format('The adjustment must be exactly %s.', v_delta);
    end if;
    insert into public.sale_payments (sale_id, kind, method, amount, reference, created_by)
    values (v_sale.id, 'adjustment', v_method, v_amount,
            left(nullif(trim(p_payment_adjustment ->> 'reference'), ''), 60), v_actor.user_id);
  elsif p_payment_adjustment is not null and coalesce((p_payment_adjustment ->> 'amount')::integer, 0) <> 0 then
    raise exception 'adjustment_not_needed' using detail = 'The total does not change, so no money moves.';
  end if;

  update public.sale_items
    set service_id = v_service_id,
        item_name = v_name,
        list_price = v_list,
        unit_price = v_unit,
        quantity = v_qty,
        line_total = v_unit * v_qty,
        duration_minutes = v_duration,
        price_override_reason = case when v_unit <> v_list then v_reason end
    where id = p_item_id;

  v_new_total := private.recompute_sale_totals(v_sale.id);

  if v_service_changed then
    perform private.write_audit('sale_item', p_item_id, 'item_service_changed',
      jsonb_build_object('service_id', v_item.service_id, 'item_name', v_item.item_name,
                         'sale_id', v_sale.id, 'receipt_no', v_sale.receipt_no),
      jsonb_build_object('service_id', v_service_id, 'item_name', v_name),
      v_reason);
  end if;
  if v_price_changed or v_delta <> 0 then
    perform private.write_audit('sale_item', p_item_id, 'item_price_changed',
      jsonb_build_object('unit_price', v_item.unit_price, 'quantity', v_item.quantity,
                         'line_total', v_item.line_total, 'sale_total', v_sale.total,
                         'sale_id', v_sale.id, 'receipt_no', v_sale.receipt_no, 'item_name', v_item.item_name),
      jsonb_build_object('unit_price', v_unit, 'quantity', v_qty, 'line_total', v_unit * v_qty,
                         'sale_total', v_new_total,
                         'adjustment', case when v_delta <> 0 then jsonb_build_object('method', v_method, 'amount', v_delta) end),
      v_reason);
  end if;

  return jsonb_build_object('sale_id', v_sale.id, 'total', v_new_total, 'delta', v_delta);
end;
$$;

-- -----------------------------------------------------------------------------
-- Voids. A sale is never deleted. Only the owner voids, directly or by
-- approving a counter user's request.
-- -----------------------------------------------------------------------------
create or replace function private.void_sale_internal(p_sale_id uuid, p_actor_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That sale was not found.';
  end if;
  if v_sale.status = 'voided' then
    raise exception 'already_voided' using detail = 'This sale was already voided.';
  end if;
  update public.sales
    set status = 'voided', voided_at = now(), voided_by = p_actor_id, void_reason = p_reason
    where id = p_sale_id
    returning * into v_sale;
  perform private.write_audit('sale', p_sale_id, 'sale_voided',
    jsonb_build_object('status', 'paid', 'total', v_sale.total, 'receipt_no', v_sale.receipt_no),
    jsonb_build_object('status', 'voided'),
    p_reason);
  return v_sale;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v_actor from private.require_pos_user(array['owner']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for voiding the sale.';
  end if;
  perform private.void_sale_internal(p_sale_id, v_actor.user_id, v_reason);
  -- A pending request for this sale is settled by the direct void.
  update public.void_requests
    set status = 'approved', decided_by = v_actor.user_id, decided_at = now(),
        decision_note = 'Voided directly by the owner.'
    where sale_id = p_sale_id and status = 'pending';
end;
$$;

-- Counter: ask the owner to void one of today's sales.
create or replace function public.request_void(p_sale_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_sale public.sales;
  v_reason text := nullif(trim(p_reason), '');
  v_request_id uuid;
begin
  select * into v_actor from private.require_pos_user(array['counter']);
  if v_reason is null then
    raise exception 'reason_required' using detail = 'Give a reason for the void request.';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or not private.can_see_sale(v_sale.business_date, v_sale.recorded_at) then
    raise exception 'not_found' using detail = 'That sale was not found among today''s sales.';
  end if;
  if v_sale.status = 'voided' then
    raise exception 'already_voided' using detail = 'This sale was already voided.';
  end if;

  begin
    insert into public.void_requests (sale_id, requested_by, reason)
    values (p_sale_id, v_actor.user_id, left(v_reason, 500))
    returning id into v_request_id;
  exception when unique_violation then
    raise exception 'void_already_requested' using detail = 'A void request for this sale is already waiting for the owner.';
  end;

  perform private.write_audit('void_request', v_request_id, 'void_requested', null,
    jsonb_build_object('sale_id', p_sale_id, 'receipt_no', v_sale.receipt_no, 'total', v_sale.total),
    v_reason);
  perform private.create_owner_alert('void_requested', p_sale_id, jsonb_build_object(
    'receipt_no', v_sale.receipt_no, 'total', v_sale.total, 'reason', v_reason, 'by', v_actor.user_name));
  return v_request_id;
end;
$$;

-- Counter: withdraw your own pending request.
create or replace function public.cancel_void_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_request public.void_requests;
begin
  select * into v_actor from private.require_pos_user(array['counter']);
  select * into v_request from public.void_requests where id = p_request_id for update;
  if not found or v_request.requested_by <> v_actor.user_id then
    raise exception 'not_found' using detail = 'That void request was not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'not_pending' using detail = 'This request was already decided.';
  end if;
  update public.void_requests
    set status = 'cancelled', decided_by = v_actor.user_id, decided_at = now()
    where id = p_request_id;
  perform private.write_audit('void_request', p_request_id, 'void_request_cancelled', null,
    jsonb_build_object('sale_id', v_request.sale_id));
end;
$$;

-- Owner: approve (voids the sale) or reject (note required), in one transaction.
create or replace function public.decide_void_request(p_request_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_request public.void_requests;
  v_note text := nullif(trim(p_note), '');
begin
  select * into v_actor from private.require_pos_user(array['owner']);
  if p_approve is null then
    raise exception 'invalid_input' using detail = 'Approve or reject the request.';
  end if;
  select * into v_request from public.void_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using detail = 'That void request was not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'not_pending' using detail = 'This request was already decided.';
  end if;

  if p_approve then
    perform private.void_sale_internal(v_request.sale_id, v_actor.user_id, v_request.reason);
    update public.void_requests
      set status = 'approved', decided_by = v_actor.user_id, decided_at = now(), decision_note = left(v_note, 500)
      where id = p_request_id;
    perform private.write_audit('void_request', p_request_id, 'void_request_approved', null,
      jsonb_build_object('sale_id', v_request.sale_id), v_note);
  else
    if v_note is null then
      raise exception 'note_required' using detail = 'Say why the request is rejected.';
    end if;
    update public.void_requests
      set status = 'rejected', decided_by = v_actor.user_id, decided_at = now(), decision_note = left(v_note, 500)
      where id = p_request_id;
    perform private.write_audit('void_request', p_request_id, 'void_request_rejected', null,
      jsonb_build_object('sale_id', v_request.sale_id), v_note);
  end if;
end;
$$;
