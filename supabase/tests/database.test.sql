-- =============================================================================
-- Database tests for spec 02 (money rules, permissions, RLS, audit log).
--
-- Run with: npm run test:db
-- The whole file runs as ONE transaction against the linked development
-- project and ALWAYS ends with an error on purpose, so nothing it creates
-- (test users, sales, appointments) is ever kept. The error message carries
-- the results in TAP style ("ok 1 - ...", "not ok 2 - ...").
-- Never point this at the production project.
-- =============================================================================

create temp table tap (n serial, ok boolean, description text, detail text) on commit drop;

create function pg_temp.expect(p_ok boolean, p_description text, p_detail text default null)
returns void language sql as $$
  insert into tap (ok, description, detail) values (coalesce(p_ok, false), p_description, p_detail)
$$;

-- Runs p_sql as a POS user (or as a website visitor when p_user is null) and
-- returns 'OK' or the error message. The role switch is undone afterwards.
create function pg_temp.run_as(p_user uuid, p_sql text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  begin
    if p_user is null then
      execute 'set local role anon';
    else
      execute 'set local role authenticated';
    end if;
    execute p_sql;
    execute 'reset role';
    return 'OK';
  exception when others then
    return sqlerrm;
  end;
end;
$$;

-- Clears the simulated user, so the next statements run as the database owner.
create function pg_temp.as_db_owner()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- Like run_as, but returns the first column of the first row as jsonb (or
-- raises the error, so a broken fixture fails loudly).
create function pg_temp.call_as(p_user uuid, p_sql text)
returns jsonb language plpgsql as $$
declare
  v_out jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  execute 'set local role authenticated';
  execute p_sql into v_out;
  execute 'reset role';
  return v_out;
end;
$$;

do $test$
declare
  v_owner uuid := gen_random_uuid();
  v_counter uuid := gen_random_uuid();
  v_category uuid;
  v_cut uuid;
  v_wash uuid;
  v_kofi uuid;
  v_kwame uuid;
  v_result jsonb;
  v_sale uuid;
  v_old_sale uuid;
  v_item uuid;
  v_request uuid;
  v_message text;
  v_count bigint;
  v_close jsonb;
  v_slot timestamptz := date_trunc('hour', now()) + interval '3 days';
  v_phone constant text := '+233209999001';
  v_new_phone constant text := '+233209999002';
  v_items_ok constant text := '[{"service_id": "%s", "staff_id": "%s", "unit_price": 10000, "quantity": 1}]';
begin
  -- ---------------------------------------------------------------------------
  -- Fixtures (as the database owner)
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner.test@example.invalid', '{}', '{}', now(), now()),
    (v_counter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'counter.test@example.invalid', '{}', '{}', now(), now());
  insert into public.profiles (id, display_name, role) values
    (v_owner, 'Test Owner', 'owner'),
    (v_counter, 'Test Counter', 'counter');

  update public.studio_settings set max_counter_discount_percent = 20, counter_backdate_days = 3,
    default_opening_float = 20000, cash_difference_tolerance = 0, override_alert_threshold = 5000;

  insert into public.service_categories (name) values ('Test category') returning id into v_category;
  insert into public.services (category_id, name, price, duration_minutes)
    values (v_category, 'Test cut', 10000, 45) returning id into v_cut;
  insert into public.services (category_id, name, price, duration_minutes)
    values (v_category, 'Test wash', 4000, 30) returning id into v_wash;
  insert into public.staff (name) values ('Test Kofi') returning id into v_kofi;
  insert into public.staff (name) values ('Test Kwame') returning id into v_kwame;
  insert into public.service_staff (service_id, staff_id) values (v_cut, v_kofi), (v_cut, v_kwame);

  -- ---------------------------------------------------------------------------
  -- create_sale
  -- ---------------------------------------------------------------------------
  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "customer_phone": "%s", "customer_name": "Test Ama",
      "items": %s, "payments": [{"method": "cash", "amount": 10000, "tendered": 20000}]}'::jsonb)
  $q$, '00000000-0000-4000-8000-000000000001', v_phone, format(v_items_ok, v_cut, v_kofi)));
  v_sale := (v_result ->> 'sale_id')::uuid;
  perform pg_temp.expect(v_sale is not null and (v_result ->> 'existing')::boolean = false,
    'counter creates a paid sale', v_result::text);
  perform pg_temp.expect(
    (select count(*) from public.sale_items where sale_id = v_sale) = 1
    and (select count(*) from public.sale_payments where sale_id = v_sale) = 1
    and (select total from public.sales where id = v_sale) = 10000
    and exists (select 1 from public.customers where phone = v_phone and full_name = 'Test Ama')
    and (select created_by from public.sales where id = v_sale) = v_counter,
    'create_sale writes the sale, its line, its payment, the customer, and created_by');
  perform pg_temp.expect((select receipt_no from public.sales where id = v_sale) ~ '^BLS-[0-9]{6,}$',
    'receipt numbers look like BLS-000123');

  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "items": %s, "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, '00000000-0000-4000-8000-000000000001', format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect((v_result ->> 'sale_id')::uuid = v_sale and (v_result ->> 'existing')::boolean
    and (select count(*) from public.sales where client_request_id = '00000000-0000-4000-8000-000000000001') = 1,
    'a repeated client_request_id returns the first sale instead of a second one');

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "items": %s, "payments": [{"method": "cash", "amount": 9000}]}'::jsonb)
  $q$, gen_random_uuid(), format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect(v_message = 'payments_mismatch', 'create_sale rejects payments that do not equal the total', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s",
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 9000}],
      "payments": [{"method": "cash", "amount": 9000}]}'::jsonb)
  $q$, gen_random_uuid(), v_cut, v_kofi));
  perform pg_temp.expect(v_message = 'override_reason_required', 'a changed price without a reason is rejected', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s",
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 7000, "price_override_reason": "Friend"}],
      "payments": [{"method": "cash", "amount": 7000}]}'::jsonb)
  $q$, gen_random_uuid(), v_cut, v_kofi));
  perform pg_temp.expect(v_message = 'discount_limit', 'a counter discount above the limit (30% > 20%) is rejected', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s",
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 8000, "price_override_reason": "Regular"}],
      "payments": [{"method": "momo", "amount": 8000, "reference": "MP1"}]}'::jsonb)
  $q$, gen_random_uuid(), v_cut, v_kofi));
  perform pg_temp.expect(v_message = 'OK', 'a counter discount within the limit (20%) is allowed', v_message);

  v_message := pg_temp.run_as(v_owner, format($q$
    select public.create_sale('{"client_request_id": "%s",
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 3000, "price_override_reason": "Owner special"}],
      "payments": [{"method": "cash", "amount": 3000}]}'::jsonb)
  $q$, gen_random_uuid(), v_cut, v_kofi));
  perform pg_temp.expect(v_message = 'OK', 'the owner has no discount limit (reason still required)', v_message);

  -- Atomicity: the line insert fails (reason longer than 300 characters) after
  -- the sale row was written; nothing at all may remain.
  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "00000000-0000-4000-8000-000000000099", "customer_phone": "%s",
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 9000, "price_override_reason": "%s"}],
      "payments": [{"method": "cash", "amount": 9000}]}'::jsonb)
  $q$, v_new_phone, v_cut, v_kofi, repeat('x', 301)));
  perform pg_temp.expect(v_message <> 'OK'
    and not exists (select 1 from public.sales where client_request_id = '00000000-0000-4000-8000-000000000099')
    and not exists (select 1 from public.customers where phone = v_new_phone),
    'a failing create_sale leaves no sale, line, payment, or customer behind', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), now() - interval '5 days', format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect(v_message = 'backdate_limit', 'the counter cannot record a sale more than 3 days back', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), now() + interval '1 hour', format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect(v_message = 'future_time', 'a sale cannot be recorded in the future', v_message);

  -- The database itself refuses unbalanced sales, even outside the functions.
  begin
    insert into public.sales (subtotal, discount_total, total, created_by, client_request_id)
      values (5000, 0, 5000, v_owner, gen_random_uuid()) returning id into v_old_sale;
    insert into public.sale_items (sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price, quantity, line_total)
      values (v_old_sale, 1, v_wash, 'Test wash', v_kofi, 5000, 5000, 1, 5000);
    set constraints all immediate;
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  set constraints all deferred;
  perform pg_temp.expect(v_message = 'payments_mismatch', 'a sale whose payments do not add up cannot be saved by any path', v_message);

  -- ---------------------------------------------------------------------------
  -- Owner-only actions
  -- ---------------------------------------------------------------------------
  v_message := pg_temp.run_as(v_counter, format($q$ select public.void_sale(%L, 'test') $q$, v_sale));
  perform pg_temp.expect(v_message = 'not_authorized', 'a counter user calling void_sale is rejected', v_message);

  select id into v_item from public.sale_items where sale_id = v_sale;
  v_message := pg_temp.run_as(v_counter, format($q$
    select public.edit_sale_item(%L, '{"unit_price": 12000}'::jsonb, '{"method": "cash", "amount": 2000}'::jsonb, 'test')
  $q$, v_item));
  perform pg_temp.expect(v_message = 'not_authorized', 'a counter user calling edit_sale_item is rejected', v_message);

  v_message := pg_temp.run_as(v_owner, format($q$
    select public.edit_sale_item(%L, '{"unit_price": 12000}'::jsonb, null, 'Longer cut than booked')
  $q$, v_item));
  perform pg_temp.expect(v_message = 'adjustment_required', 'an edit that changes the total needs the money difference recorded', v_message);

  v_message := pg_temp.run_as(v_owner, format($q$
    select public.edit_sale_item(%L, '{"unit_price": 12000}'::jsonb, '{"method": "cash", "amount": 2000}'::jsonb, 'Longer cut than booked')
  $q$, v_item));
  perform pg_temp.expect(v_message = 'OK'
    and (select total from public.sales where id = v_sale) = 12000
    and (select sum(amount) from public.sale_payments where sale_id = v_sale) = 12000
    and exists (select 1 from public.audit_log where entity_id = v_item and action = 'item_price_changed'),
    'the owner edits a paid line; payments still equal the total and the change is logged', v_message);

  -- ---------------------------------------------------------------------------
  -- Reassigning staff
  -- ---------------------------------------------------------------------------
  v_message := pg_temp.run_as(v_counter, format($q$ select public.reassign_sale_item_staff(%L, %L, 'Staff was busy') $q$, v_item, v_kwame));
  perform pg_temp.expect(v_message = 'OK'
    and (select staff_id from public.sale_items where id = v_item) = v_kwame
    and exists (select 1 from public.audit_log where entity_id = v_item and action = 'staff_reassigned'
                and before ->> 'staff_id' = v_kofi::text and after ->> 'staff_id' = v_kwame::text),
    'the counter reassigns a line on today''s sale and the change is logged with before and after', v_message);

  v_result := pg_temp.call_as(v_owner, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), now() - interval '2 days', format(v_items_ok, v_cut, v_kofi)));
  v_old_sale := (v_result ->> 'sale_id')::uuid;
  perform pg_temp.expect((select is_backdated from public.sales where id = v_old_sale)
    and (select recorded_at::date - business_date from public.sales where id = v_old_sale) >= 1
    and exists (select 1 from public.owner_alerts where sale_id = v_old_sale and kind = 'backdated_sale'),
    'a backdated sale lands on its real day, is flagged, and alerts the owner');

  select id into v_item from public.sale_items where sale_id = v_old_sale;
  v_message := pg_temp.run_as(v_counter, format($q$ select public.reassign_sale_item_staff(%L, %L, 'Wrong staff') $q$, v_item, v_kwame));
  perform pg_temp.expect(v_message = 'reassign_window', 'a counter user reassigning a line from a previous day is rejected', v_message);

  v_message := pg_temp.run_as(v_owner, format($q$ select public.reassign_sale_item_staff(%L, %L, 'Wrong staff') $q$, v_item, v_kwame));
  perform pg_temp.expect(v_message = 'OK', 'the owner can reassign a line on any day', v_message);

  -- ---------------------------------------------------------------------------
  -- RLS: the counter sees today only; visitors see no money at all
  -- ---------------------------------------------------------------------------
  v_count := (pg_temp.call_as(v_counter, format($q$ select to_jsonb(count(*)) from public.sales where id = %L $q$, v_old_sale)))::text::bigint;
  perform pg_temp.expect(v_count = 1, 'the counter can read a past sale that was recorded today');

  -- A sale made and recorded two days ago (inserted directly, balanced).
  perform pg_temp.as_db_owner();
  insert into public.sales (subtotal, discount_total, total, paid_at, recorded_at, created_by, client_request_id)
    values (4000, 0, 4000, now() - interval '2 days', now() - interval '2 days', v_owner, gen_random_uuid())
    returning id into v_old_sale;
  insert into public.sale_items (sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price, quantity, line_total)
    values (v_old_sale, 1, v_wash, 'Test wash', v_kofi, 4000, 4000, 1, 4000);
  insert into public.sale_payments (sale_id, method, amount) values (v_old_sale, 'cash', 4000);

  v_count := (pg_temp.call_as(v_counter, format($q$ select to_jsonb(count(*)) from public.sales where id = %L $q$, v_old_sale)))::text::bigint;
  perform pg_temp.expect(v_count = 0, 'the counter cannot read a sale from two days ago');
  v_count := (pg_temp.call_as(v_counter, format($q$ select to_jsonb(count(*)) from public.sale_items where sale_id = %L $q$, v_old_sale)))::text::bigint;
  perform pg_temp.expect(v_count = 0, 'the counter cannot read the lines of a sale from two days ago');
  v_count := (pg_temp.call_as(v_owner, format($q$ select to_jsonb(count(*)) from public.sales where id = %L $q$, v_old_sale)))::text::bigint;
  perform pg_temp.expect(v_count = 1, 'the owner can read every sale');

  perform pg_temp.expect(pg_temp.run_as(null, 'select * from public.sales limit 1') like 'permission denied%', 'anon cannot read sales');
  perform pg_temp.expect(pg_temp.run_as(null, 'select * from public.customers limit 1') like 'permission denied%', 'anon cannot read customers');
  perform pg_temp.expect(pg_temp.run_as(null, 'select * from public.appointments limit 1') like 'permission denied%', 'anon cannot read appointments');
  perform pg_temp.expect(pg_temp.run_as(null, 'select * from public.audit_log limit 1') like 'permission denied%', 'anon cannot read audit_log');
  perform pg_temp.expect(pg_temp.run_as(null, 'select phone from public.staff limit 1') like 'permission denied%', 'anon cannot read staff phone numbers');
  perform pg_temp.expect(pg_temp.run_as(null, 'select name, title from public.public_staff limit 1') = 'OK', 'anon can read the public staff view');
  perform pg_temp.expect(pg_temp.run_as(null, 'select owner_alert_phone from public.studio_settings') like 'permission denied%', 'anon cannot read internal settings');
  perform pg_temp.expect(pg_temp.run_as(null, $q$ select public.create_sale('{}'::jsonb) $q$) like 'permission denied%', 'anon cannot call create_sale');
  perform pg_temp.expect(pg_temp.run_as(v_counter, $q$ select public.create_appointment('{}'::jsonb) $q$) like 'permission denied%', 'POS users cannot call create_appointment directly');

  -- ---------------------------------------------------------------------------
  -- Voids
  -- ---------------------------------------------------------------------------
  v_result := pg_temp.call_as(v_counter, format($q$ select to_jsonb(public.request_void(%L, 'Customer left before the service')) $q$, v_sale));
  v_request := (v_result #>> '{}')::uuid;
  v_message := pg_temp.run_as(v_counter, format($q$ select public.request_void(%L, 'Again') $q$, v_sale));
  perform pg_temp.expect(v_request is not null and v_message = 'void_already_requested'
    and exists (select 1 from public.owner_alerts where sale_id = v_sale and kind = 'void_requested'),
    'the counter requests a void once, the owner is alerted, and a second request is refused', v_message);

  v_message := pg_temp.run_as(v_owner, format($q$ select public.decide_void_request(%L, true, 'OK') $q$, v_request));
  perform pg_temp.expect(v_message = 'OK'
    and (select status from public.sales where id = v_sale) = 'voided'
    and (select status from public.void_requests where id = v_request) = 'approved',
    'approving a request voids the sale and closes the request', v_message);
  perform pg_temp.expect(exists (select 1 from public.sales where id = v_sale and void_reason is not null and voided_by = v_owner)
    and exists (select 1 from public.audit_log where entity_id = v_sale and action = 'sale_voided'),
    'void keeps the sale row, with the reason, who voided it, and a history row');

  begin
    delete from public.sales where id = v_sale;
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'records_are_never_deleted', 'sales cannot be deleted, even by the database owner', v_message);

  -- ---------------------------------------------------------------------------
  -- Close day
  -- ---------------------------------------------------------------------------
  v_close := pg_temp.call_as(v_counter, format($q$
    select public.close_day(%L::date, 50000, null, null, 'Test close')
  $q$, private.accra_today()));
  perform pg_temp.expect(
    (v_close ->> 'cash_difference')::integer = 50000 - (v_close ->> 'expected_cash')::integer
    and (v_close ->> 'expected_cash')::integer = 20000 + (v_close ->> 'cash')::integer
    and exists (select 1 from public.day_closes where business_date = private.accra_today() and reopened_at is null
                and cash_difference = (v_close ->> 'cash_difference')::integer and counted_cash = 50000)
    and exists (select 1 from public.owner_alerts where kind = 'day_summary' and payload ->> 'business_date' = private.accra_today()::text),
    'close_day stores counted, expected (float + cash), and the difference, and queues the day summary', v_close::text);

  v_message := pg_temp.run_as(v_counter, format($q$ select public.close_day(%L::date, 1, null, null, null) $q$, private.accra_today()));
  perform pg_temp.expect(v_message = 'already_closed', 'a second close of the same day fails', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$ select public.reopen_day(%L::date, 'Late sale') $q$, private.accra_today()));
  perform pg_temp.expect(v_message = 'not_authorized', 'the counter cannot reopen a day', v_message);

  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "items": %s, "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect((v_result ->> 'after_close')::boolean
    and exists (select 1 from public.owner_alerts where sale_id = (v_result ->> 'sale_id')::uuid and kind = 'after_close_sale'),
    'a sale after the day is closed is allowed, flagged after_close, and alerts the owner');

  v_message := pg_temp.run_as(v_owner, format($q$ select public.reopen_day(%L::date, 'Late customer') $q$, private.accra_today()));
  perform pg_temp.expect(v_message = 'OK', 'the owner reopens the day with a reason', v_message);
  v_message := pg_temp.run_as(v_counter, format($q$ select public.close_day(%L::date, 60000, null, null, null) $q$, private.accra_today()));
  perform pg_temp.expect(v_message = 'OK'
    and (select count(*) from public.day_closes where business_date = private.accra_today()) >= 2,
    'after reopening, the day can be closed again and both closes stay in history', v_message);

  v_message := pg_temp.run_as(v_counter, format($q$ select public.close_day(%L::date, 1, null, 99999, null) $q$, private.accra_today() - 20));
  perform pg_temp.expect(v_message = 'float_reason_required', 'changing the opening float needs a reason', v_message);

  -- ---------------------------------------------------------------------------
  -- Appointments: no double booking
  -- ---------------------------------------------------------------------------
  perform pg_temp.as_db_owner();
  v_result := public.create_appointment(jsonb_build_object(
    'service_id', v_cut, 'staff_id', v_kofi, 'starts_at', v_slot, 'customer_phone', '+233209999010',
    'customer_name', 'Booker One', 'source', 'web'));
  perform pg_temp.expect(v_result ->> 'code' ~ '^BK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'
    and length(v_result ->> 'public_token') >= 32,
    'a booking gets a short code without look-alike characters and a long token', v_result::text);

  begin
    perform public.create_appointment(jsonb_build_object(
      'service_id', v_cut, 'staff_id', v_kofi, 'starts_at', v_slot + interval '30 minutes',
      'customer_phone', '+233209999011', 'customer_name', 'Booker Two', 'source', 'web'));
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'slot_taken', 'an overlapping appointment for the same staff member is rejected', v_message);

  begin
    perform public.create_appointment(jsonb_build_object(
      'service_id', v_cut, 'staff_id', v_kofi, 'starts_at', v_slot + interval '45 minutes',
      'customer_phone', '+233209999012', 'customer_name', 'Booker Three', 'source', 'web'));
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'OK', 'a back-to-back appointment is allowed', v_message);

  begin
    perform public.create_appointment(jsonb_build_object(
      'service_id', v_cut, 'staff_id', v_kwame, 'starts_at', v_slot + interval '30 minutes',
      'customer_phone', '+233209999011', 'customer_name', 'Booker Two', 'source', 'web'));
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'OK', 'the same time with a different staff member is allowed', v_message);

  perform pg_temp.as_db_owner();
  update public.customers set blocked = true, blocked_reason = 'Test no-shows' where phone = '+233209999010';
  begin
    perform public.create_appointment(jsonb_build_object(
      'service_id', v_cut, 'staff_id', v_kwame, 'starts_at', v_slot + interval '1 day',
      'customer_phone', '+233209999010', 'customer_name', 'Booker One', 'source', 'web'));
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'customer_blocked', 'a blocked number cannot book online', v_message);

  v_message := pg_temp.run_as(v_counter, $q$ update public.customers set blocked = false where phone = '+233209999010' $q$);
  perform pg_temp.expect(v_message = 'not_authorized', 'only the owner can unblock a number', v_message);

  -- ---------------------------------------------------------------------------
  -- The audit log is append-only for everyone
  -- ---------------------------------------------------------------------------
  begin
    update public.audit_log set reason = 'changed' where id = (select max(id) from public.audit_log);
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'audit_log_is_append_only', 'audit_log rows cannot be updated (even by the database owner)', v_message);

  begin
    delete from public.audit_log where id = (select max(id) from public.audit_log);
    v_message := 'OK';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.expect(v_message = 'audit_log_is_append_only', 'audit_log rows cannot be deleted (even by the database owner)', v_message);

  v_message := pg_temp.run_as(v_owner, 'delete from public.audit_log');
  perform pg_temp.expect(v_message like 'permission denied%', 'the owner account has no delete permission on audit_log', v_message);

  -- Price changes in the catalog are logged automatically.
  perform pg_temp.run_as(v_owner, format($q$ update public.services set price = 11000 where id = %L $q$, v_cut));
  perform pg_temp.expect(exists (select 1 from public.audit_log where entity_id = v_cut and action = 'service_price_changed'
                                 and (before ->> 'price')::integer = 10000 and (after ->> 'price')::integer = 11000),
    'a service price change writes service_price_changed with the old and new price');
  perform pg_temp.expect(pg_temp.run_as(v_counter, format($q$ update public.services set price = 1 where id = %L $q$, v_cut)) = 'OK'
    and (select price from public.services where id = v_cut) = 11000,
    'a counter user cannot change prices (the update matches no rows)');

  -- Owner alerts are claimed once per occurrence (a rerun job or a retry
  -- cannot queue a second SMS for the same thing).
  perform pg_temp.as_db_owner();
  perform private.create_owner_alert('day_not_closed', null, '{}'::jsonb, 'day_not_closed:2000-01-01');
  perform private.create_owner_alert('day_not_closed', null, '{}'::jsonb, 'day_not_closed:2000-01-01');
  perform pg_temp.expect((select count(*) from public.owner_alerts where occurrence_key = 'day_not_closed:2000-01-01') = 1,
    'the same alert occurrence is queued only once');
  perform pg_temp.expect((select count(*) from public.owner_alerts where kind = 'void_requested' and sale_id = v_sale) = 1,
    'sale alerts stay at most one per kind per sale');
end;
$test$;

-- Report and roll back. This error is expected: it is how the results come
-- back and how everything above is undone.
do $report$
declare
  r record;
  v_out text := '';
  v_failed integer := 0;
begin
  -- Failures first, so they are never lost if the message is cut short.
  for r in select * from tap order by ok, n loop
    v_out := v_out || case when r.ok then 'ok ' else 'not ok ' end || r.n || ' - ' || r.description
             || case when not r.ok and r.detail is not null then ' # got: ' || left(r.detail, 300) else '' end || E'\n';
    if not r.ok then
      v_failed := v_failed + 1;
    end if;
  end loop;
  raise exception 'DB_TEST_RESULTS failed=% total=% %', v_failed, (select count(*) from tap), E'\n' || v_out;
end;
$report$;
