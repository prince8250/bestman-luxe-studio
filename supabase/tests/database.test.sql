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
  -- Test sessions use the user's id as the session id (see the fixtures).
  perform set_config('request.jwt.claims',
    case when p_user is null then ''
         else json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_user)::text end, true);
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
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_user)::text, true);
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
  v_sale2 uuid;
  v_request2 uuid;
  v_sale3 uuid;
  v_item3 uuid;
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
  -- A live Auth session for each (a POS user needs one; see private.has_live_session).
  insert into auth.sessions (id, user_id) values (v_owner, v_owner), (v_counter, v_counter);

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

  -- Record a past sale (spec 12): the owner may go 14 days back, the counter
  -- only as far as Settings allows (3 here).
  v_message := pg_temp.run_as(v_owner, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), now() - interval '20 days', format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect(v_message = 'backdate_limit', 'the owner cannot record a sale more than 14 days back', v_message);
  v_message := pg_temp.run_as(v_owner, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), now() - interval '10 days', format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.expect(v_message = 'OK', 'the owner can record a sale 10 days back (beyond the counter''s limit)', v_message);

  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "paid_at": "%s", "items": %s,
      "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), (((private.accra_today() - 1)::timestamp + interval '14 hours 30 minutes') at time zone 'Africa/Accra'), format(v_items_ok, v_cut, v_kofi)));
  perform pg_temp.as_db_owner();
  perform pg_temp.expect(
    (select business_date = private.accra_today() - 1 and is_backdated and private.accra_date(recorded_at) = private.accra_today()
       from public.sales where id = (v_result ->> 'sale_id')::uuid)
    and exists (select 1 from public.audit_log where entity_id = (v_result ->> 'sale_id')::uuid and action = 'sale_backdated')
    and (pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"from": "%s", "to": "%s", "recorded_by": "%s", "limit": 100}'::jsonb) $q$,
           private.accra_today() - 1, private.accra_today() - 1, v_counter)) -> 'rows')
        @> jsonb_build_array(jsonb_build_object('id', v_result ->> 'sale_id', 'is_backdated', true)),
    'a sale backdated to yesterday lands on yesterday, is flagged, is logged, and shows in yesterday''s sales', v_result::text);

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

  -- The owner manages staff and settings through their own session (RLS and
  -- the check constraints run as that user).
  v_message := pg_temp.run_as(v_owner, $q$
    insert into public.staff (name, title, phone, show_on_website, bookable_online, sort_order)
    values ('Test Yaw', 'Barber', '+233245551234', true, true, 9)
  $q$);
  perform pg_temp.expect(v_message = 'OK', 'the owner can add a staff member with a phone number', v_message);
  v_message := pg_temp.run_as(v_owner, $q$
    update public.staff set active = false, archived_at = now() where name = 'Test Yaw'
  $q$);
  perform pg_temp.expect(v_message = 'OK'
    and exists (select 1 from public.audit_log where action = 'staff_archived' and after ->> 'name' = 'Test Yaw'),
    'the owner can archive a staff member and the change is logged', v_message);
  v_message := pg_temp.run_as(v_counter, $q$
    insert into public.staff (name) values ('Sneaky')
  $q$);
  perform pg_temp.expect(v_message like 'new row violates row-level security%', 'a counter user cannot add staff', v_message);
  v_message := pg_temp.run_as(v_owner, $q$
    update public.studio_settings set phone = '+233241112222', owner_alert_phone = '+233241113333'
  $q$);
  perform pg_temp.expect(v_message = 'OK', 'the owner can update studio settings, including phone numbers', v_message);

  -- Catalog functions (spec 06): owner only, one transaction each.
  v_message := pg_temp.run_as(v_counter, format($q$
    select public.save_service('{"category_id": "%s", "name": "Sneaky cut", "price": 100, "duration_minutes": 30}'::jsonb)
  $q$, v_category));
  perform pg_temp.expect(v_message = 'not_authorized', 'a counter user cannot add services', v_message);

  v_result := pg_temp.call_as(v_owner, format($q$
    select to_jsonb(public.save_service('{"category_id": "%s", "name": "Test fade", "price": 6000,
      "duration_minutes": 40, "staff_ids": ["%s", "%s"]}'::jsonb))
  $q$, v_category, v_kofi, v_kwame));
  perform pg_temp.expect((select count(*) from public.service_staff where service_id = (v_result #>> '{}')::uuid) = 2,
    'the owner saves a service together with its staff assignments');
  perform pg_temp.call_as(v_owner, format($q$
    select to_jsonb(public.save_service('{"id": "%s", "category_id": "%s", "name": "Test fade", "price": 6500,
      "duration_minutes": 40, "staff_ids": ["%s"]}'::jsonb))
  $q$, v_result #>> '{}', v_category, v_kwame));
  perform pg_temp.expect(
    (select array_agg(staff_id) from public.service_staff where service_id = (v_result #>> '{}')::uuid) = array[v_kwame]
    and exists (select 1 from public.audit_log where entity_id = (v_result #>> '{}')::uuid and action = 'service_price_changed'
                and (before ->> 'price')::integer = 6000 and (after ->> 'price')::integer = 6500),
    'editing a service replaces its staff list and logs the price change');

  v_count := (pg_temp.call_as(v_owner, format($q$
    select to_jsonb(public.update_service_prices('[{"id": "%s", "price": 4500}, {"id": "%s", "price": 7000}]'::jsonb))
  $q$, v_wash, v_result #>> '{}')))::text::bigint;
  perform pg_temp.expect(v_count = 2
    and (select count(*) from public.audit_log where action = 'service_price_changed'
         and entity_id in (v_wash, (v_result #>> '{}')::uuid) and (after ->> 'price')::integer in (4500, 7000)) = 2,
    'saving many prices at once logs one change per service');

  perform pg_temp.call_as(v_owner, format($q$
    select to_jsonb(public.reorder_rows('services', array['%s', '%s']::uuid[]) is null)
  $q$, v_wash, v_cut));
  perform pg_temp.expect((select sort_order from public.services where id = v_wash) = 10
    and (select sort_order from public.services where id = v_cut) = 20,
    'reorder_rows saves the new order');
  v_message := pg_temp.run_as(v_owner, $q$ select public.reorder_rows('sales', array[]::uuid[]) $q$);
  perform pg_temp.expect(v_message = 'invalid_input', 'reorder_rows only works on the owner-managed lists', v_message);

  -- Price changes in the catalog are logged automatically.
  perform pg_temp.run_as(v_owner, format($q$ update public.services set price = 11000 where id = %L $q$, v_cut));
  perform pg_temp.expect(exists (select 1 from public.audit_log where entity_id = v_cut and action = 'service_price_changed'
                                 and (before ->> 'price')::integer = 10000 and (after ->> 'price')::integer = 11000),
    'a service price change writes service_price_changed with the old and new price');
  perform pg_temp.expect(pg_temp.run_as(v_counter, format($q$ update public.services set price = 1 where id = %L $q$, v_cut)) = 'OK'
    and (select price from public.services where id = v_cut) = 11000,
    'a counter user cannot change prices (the update matches no rows)');

  -- Ending an account's sessions (password reset, deactivation, sign out of
  -- all devices) locks it out on the next request, not when its token expires.
  perform pg_temp.expect(pg_temp.run_as(v_counter, format($q$ select public.end_user_sessions(%L) $q$, v_owner)) like 'permission denied%',
    'only the server (service role) can end sessions');
  perform pg_temp.as_db_owner();
  perform public.end_user_sessions(v_counter);
  v_message := pg_temp.run_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "items": %s, "payments": [{"method": "cash", "amount": 10000}]}'::jsonb)
  $q$, gen_random_uuid(), format(v_items_ok, v_cut, v_kofi)));
  v_count := (pg_temp.call_as(v_counter, 'select to_jsonb(count(*)) from public.services'))::text::bigint;
  perform pg_temp.expect(v_message = 'not_authorized' and v_count = 0,
    'after their sessions are ended, an account cannot sell or read POS data even with its old token', v_message);
  perform pg_temp.as_db_owner();
  insert into auth.sessions (id, user_id) values (v_counter, v_counter);

  -- customer_lookup: visits for a returning customer, for both roles, no money.
  v_result := pg_temp.call_as(v_counter, format($q$ select public.customer_lookup(%L) $q$, v_phone));
  perform pg_temp.expect((v_result ->> 'found')::boolean and (v_result ->> 'full_name') = 'Test Ama'
    and (v_result ->> 'visits')::integer >= 0 and not (v_result ? 'total') and not (v_result ? 'spent'),
    'customer_lookup finds a returning customer with visits and no money figures', v_result::text);
  v_result := pg_temp.call_as(v_counter, $q$ select public.customer_lookup('+233209999777') $q$);
  perform pg_temp.expect(v_result = '{"found": false}'::jsonb, 'customer_lookup reports an unknown number', v_result::text);
  perform pg_temp.expect(pg_temp.run_as(null, $q$ select public.customer_lookup('+233209999777') $q$) like 'permission denied%',
    'visitors cannot look up customers');

  -- Receipts (spec 09): built from stored data, the counter sees today's only,
  -- and every print after the first is a reprint.
  v_result := pg_temp.call_as(v_counter, format($q$ select public.receipt_data(%L) $q$, v_sale));
  perform pg_temp.expect((v_result ->> 'receipt_no') ~ '^BLS-' and (v_result ->> 'counter_name') = 'Test Counter'
    and jsonb_array_length(v_result -> 'lines') >= 1 and (v_result -> 'lines' -> 0 ->> 'staff_name') is not null
    and jsonb_array_length(v_result -> 'payments') >= 1 and (v_result -> 'studio' ->> 'copies')::integer between 1 and 3
    and (v_result ->> 'prints')::integer = 0,
    'receipt_data returns the stored sale with lines, staff names, payments, the counter name, and settings', v_result::text);
  v_result := pg_temp.call_as(v_owner, format($q$
    select public.create_sale('{"client_request_id": "%s", "payments": [{"method": "momo", "amount": 4500}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 1}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kofi));
  v_result := pg_temp.call_as(v_counter, format($q$ select public.receipt_data(%L) $q$, v_result ->> 'sale_id'));
  perform pg_temp.expect((v_result ->> 'counter_name') = 'Test Owner',
    'the counter can print a receipt for a sale the owner rang today (and sees who rang it)', v_result::text);
  v_message := pg_temp.run_as(v_counter, format($q$ select public.receipt_data(%L) $q$, v_old_sale));
  perform pg_temp.expect(v_message = 'not_found', 'the counter cannot open a receipt from two days ago', v_message);
  v_result := pg_temp.call_as(v_owner, format($q$ select public.receipt_data(%L) $q$, v_old_sale));
  perform pg_temp.expect(v_result ->> 'id' = v_old_sale::text, 'the owner can open any receipt');
  perform pg_temp.expect(pg_temp.run_as(null, format($q$ select public.receipt_data(%L) $q$, v_sale)) like 'permission denied%',
    'visitors cannot open receipts');

  v_result := pg_temp.call_as(v_counter, format($q$ select to_jsonb(public.record_receipt_print(%L)) $q$, v_sale));
  v_result := v_result || pg_temp.call_as(v_counter, format($q$ select to_jsonb(public.record_receipt_print(%L)) $q$, v_sale));
  perform pg_temp.expect(v_result = '[1, 2]'::jsonb
    and (pg_temp.call_as(v_counter, format($q$ select public.receipt_data(%L) $q$, v_sale)) ->> 'prints')::integer = 2,
    'record_receipt_print numbers each print (1 = original, then reprints)', v_result::text);
  v_message := pg_temp.run_as(v_counter, format($q$ insert into public.receipt_prints (sale_id, printed_by) values (%L, %L) $q$, v_sale, v_counter));
  perform pg_temp.expect(v_message like 'permission denied%', 'nobody writes receipt_prints directly', v_message);

  -- Sales history and voids (spec 10).
  -- A voided sale cannot be voided again, edited, or get a new request.
  perform pg_temp.expect(pg_temp.run_as(v_owner, format($q$ select public.void_sale(%L, 'again') $q$, v_sale)) = 'already_voided'
    and pg_temp.run_as(v_counter, format($q$ select public.request_void(%L, 'again') $q$, v_sale)) = 'already_voided'
    and pg_temp.run_as(v_owner, format($q$ select public.edit_sale_item((select id from public.sale_items where sale_id = %L limit 1),
          '{"unit_price": 1}'::jsonb, null, 'test') $q$, v_sale)) = 'sale_voided',
    'a voided sale cannot be voided again, get a void request, or be edited');

  -- Reject keeps the sale and records the note; approve voids with the request's reason and the owner.
  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "payments": [{"method": "card", "amount": 4500}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 1}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kwame));
  v_sale2 := (v_result ->> 'sale_id')::uuid;
  v_request2 := (pg_temp.call_as(v_counter, format($q$ select to_jsonb(public.request_void(%L, 'Wrong service rung')) $q$, v_sale2)) #>> '{}')::uuid;
  v_message := pg_temp.run_as(v_owner, format($q$ select public.decide_void_request(%L, false, null) $q$, v_request2));
  perform pg_temp.expect(v_message = 'note_required', 'rejecting a void request needs a note', v_message);
  perform pg_temp.run_as(v_owner, format($q$ select public.decide_void_request(%L, false, 'Customer was served') $q$, v_request2));
  perform pg_temp.as_db_owner();
  perform pg_temp.expect((select status from public.sales where id = v_sale2) = 'paid'
    and (select status || ':' || decision_note from public.void_requests where id = v_request2) = 'rejected:Customer was served',
    'rejecting keeps the sale paid and records the note');
  v_request2 := (pg_temp.call_as(v_counter, format($q$ select to_jsonb(public.request_void(%L, 'Customer changed their mind')) $q$, v_sale2)) #>> '{}')::uuid;
  perform pg_temp.run_as(v_owner, format($q$ select public.decide_void_request(%L, true, null) $q$, v_request2));
  perform pg_temp.as_db_owner();
  perform pg_temp.expect((select status || ':' || void_reason || ':' || voided_by from public.sales where id = v_sale2)
      = 'voided:Customer changed their mind:' || v_owner,
    'approving voids the sale with the request''s reason and the owner as voided_by');

  -- search_sales: the counter gets today's sales only and no money.
  v_result := pg_temp.call_as(v_counter, $q$ select public.search_sales('{"from": "2000-01-01", "limit": 100}'::jsonb) $q$);
  perform pg_temp.expect(v_result -> 'totals' = 'null'::jsonb
    and not exists (select 1 from jsonb_array_elements(v_result -> 'rows') r where r ->> 'total' is not null)
    and not exists (select 1 from jsonb_array_elements(v_result -> 'rows') r where (r ->> 'id')::uuid = v_old_sale)
    and exists (select 1 from jsonb_array_elements(v_result -> 'rows') r where (r ->> 'id')::uuid = v_sale2),
    'search_sales gives the counter today''s sales without totals or amounts (the owner-only date filter is ignored)', left(v_result::text, 300));

  -- The owner's totals match the rows: revenue counts paid sales only.
  v_result := pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"from": "%s", "to": "%s", "recorded_by": "%s", "limit": 100}'::jsonb) $q$,
    private.accra_today(), private.accra_today(), v_counter));
  perform pg_temp.expect((v_result ->> 'count')::integer = jsonb_array_length(v_result -> 'rows')
    and (v_result -> 'totals' ->> 'revenue')::bigint = (select coalesce(sum((r ->> 'total')::bigint), 0)
          from jsonb_array_elements(v_result -> 'rows') r where r ->> 'status' = 'paid')
    and (v_result -> 'totals' ->> 'voided')::integer = (select count(*) from jsonb_array_elements(v_result -> 'rows') r where r ->> 'status' = 'voided')
    and (v_result -> 'totals' ->> 'revenue')::bigint = (select coalesce(sum(value::bigint), 0) from jsonb_each_text(v_result -> 'totals' -> 'by_method')),
    'the owner''s filtered totals match the rows shown, and the methods add up to the revenue', left(v_result::text, 300));
  v_result := pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"staff_id": "%s", "method": "card", "status": "voided"}'::jsonb) $q$, v_kwame));
  perform pg_temp.expect((v_result ->> 'count')::integer = 1 and (v_result -> 'rows' -> 0 ->> 'id')::uuid = v_sale2,
    'search_sales filters by staff, payment method, and status', left(v_result::text, 300));
  v_result := pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"receipt_no": "%s"}'::jsonb) $q$,
    (select lower(receipt_no) from public.sales where id = v_old_sale)));
  perform pg_temp.expect((v_result ->> 'count')::integer = 1 and (v_result -> 'rows' -> 0 ->> 'id')::uuid = v_old_sale,
    'search_sales finds a receipt number', left(v_result::text, 300));
  perform pg_temp.expect(pg_temp.run_as(v_owner, $q$ select public.search_sales('{"from": "yesterday-ish"}'::jsonb) $q$) = 'invalid_input'
    and pg_temp.run_as(null, $q$ select public.search_sales('{}'::jsonb) $q$) like 'permission denied%',
    'search_sales refuses bad filters and visitors');

  -- sale_detail: change history for the owner only; the counter sees today's sales only.
  v_result := pg_temp.call_as(v_owner, format($q$ select public.sale_detail(%L) $q$, v_sale2));
  perform pg_temp.expect(jsonb_array_length(v_result -> 'void_requests') = 2
    and (select count(*) from jsonb_array_elements(v_result -> 'history') h
         where h ->> 'action' in ('void_requested', 'void_request_rejected', 'void_request_approved', 'sale_voided')) = 5
    and (v_result ->> 'voided_by') = 'Test Owner' and (v_result ->> 'recorded_by') = 'Test Counter',
    'sale_detail shows the requests and the full change history to the owner', left(v_result::text, 300));
  v_result := pg_temp.call_as(v_counter, format($q$ select public.sale_detail(%L) $q$, v_sale2));
  perform pg_temp.expect(v_result -> 'history' = 'null'::jsonb and (v_result -> 'void_requests' -> 0 ->> 'mine')::boolean,
    'the counter sees the sale and their own requests, but no change history', left(v_result::text, 300));
  v_message := pg_temp.run_as(v_counter, format($q$ select public.sale_detail(%L) $q$, v_old_sale));
  perform pg_temp.expect(v_message = 'not_found', 'the counter cannot open a sale from two days ago', v_message);

  -- Reassign staff and the "Changed" badge (spec 11).
  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "payments": [{"method": "cash", "amount": 4500}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 1}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kofi));
  v_sale3 := (v_result ->> 'sale_id')::uuid;
  perform pg_temp.as_db_owner();
  select id into v_item3 from public.sale_items where sale_id = v_sale3;
  perform pg_temp.expect(not (pg_temp.call_as(v_counter, format($q$ select public.sale_detail(%L) $q$, v_sale3)) ->> 'changed')::boolean,
    'a new sale is not marked changed');
  v_message := pg_temp.run_as(v_counter, format($q$ select public.reassign_sale_item_staff(%L, %L, 'Staff was busy') $q$, v_item3, v_kwame));
  perform pg_temp.expect(v_message = 'OK', 'the counter reassigns a line on today''s sale', v_message);
  perform pg_temp.expect(
    (pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"staff_id": "%s", "recorded_by": "%s", "limit": 100}'::jsonb) $q$, v_kwame, v_counter))
       -> 'rows') @> jsonb_build_array(jsonb_build_object('id', v_sale3, 'changed', true))
    and not ((pg_temp.call_as(v_owner, format($q$ select public.search_sales('{"staff_id": "%s", "recorded_by": "%s", "limit": 100}'::jsonb) $q$, v_kofi, v_counter))
       -> 'rows') @> jsonb_build_array(jsonb_build_object('id', v_sale3))),
    'after a reassignment the job counts for the new staff member, not the old one, and the sale is marked changed');
  v_result := pg_temp.call_as(v_owner, format($q$ select public.sale_detail(%L) $q$, v_sale3));
  perform pg_temp.expect((v_result -> 'lines' -> 0 ->> 'changed')::boolean and (v_result -> 'lines' -> 0 ->> 'staff_id')::uuid = v_kwame
    and (v_result ->> 'total')::integer = 4500
    and exists (select 1 from jsonb_array_elements(v_result -> 'history') h
                where h ->> 'action' = 'staff_reassigned' and h -> 'before' ->> 'staff_name' = 'Test Kofi'
                  and h -> 'after' ->> 'staff_name' = 'Test Kwame' and h ->> 'reason' = 'Staff was busy' and h ->> 'created_at' is not null),
    'the history shows from, to, reason, and time, and the total is unchanged', left(v_result::text, 300));
  v_message := pg_temp.run_as(v_counter, format($q$ select public.reassign_sale_item_staff(%L, %L, 'Again') $q$, v_item3, v_kwame));
  perform pg_temp.expect(v_message = 'no_change', 'reassigning to the same staff member is refused', v_message);
  v_message := pg_temp.run_as(v_owner, format($q$ select public.reassign_sale_item_staff((select id from public.sale_items where sale_id = %L limit 1), %L, 'x') $q$, v_sale2, v_kofi));
  perform pg_temp.expect(v_message = 'sale_voided', 'a line on a voided sale cannot be reassigned', v_message);

  -- Owner alerts are claimed once per occurrence (a rerun job or a retry
  -- cannot queue a second SMS for the same thing).
  perform pg_temp.as_db_owner();
  perform private.create_owner_alert('day_not_closed', null, '{}'::jsonb, 'day_not_closed:2000-01-01');
  perform private.create_owner_alert('day_not_closed', null, '{}'::jsonb, 'day_not_closed:2000-01-01');
  perform pg_temp.expect((select count(*) from public.owner_alerts where occurrence_key = 'day_not_closed:2000-01-01') = 1,
    'the same alert occurrence is queued only once');
  perform pg_temp.expect((select count(*) from public.owner_alerts where kind = 'void_requested' and sale_id = v_sale) = 1,
    'sale alerts stay at most one per kind per sale');

  -- Rate limits (spec 03 sign-in throttle, spec 34 bookings): service role only.
  v_count := public.rate_limit_hit('test:key', 900);
  v_count := v_count * 10 + public.rate_limit_hit('test:key', 900);
  v_count := v_count * 10 + public.rate_limit_count('test:key', 900);
  perform pg_temp.expect(v_count = 122, 'rate_limit_hit counts attempts in the current window (1, 2, then count 2)', v_count::text);
  perform public.rate_limit_clear('test:key');
  perform pg_temp.expect(public.rate_limit_count('test:key', 900) = 0, 'rate_limit_clear forgets a key');
  perform pg_temp.expect(pg_temp.run_as(null, $q$ select public.rate_limit_hit('x', 900) $q$) like 'permission denied%'
    and pg_temp.run_as(v_counter, $q$ select public.rate_limit_clear('x') $q$) like 'permission denied%',
    'visitors and POS users cannot touch the rate-limit counters');
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
