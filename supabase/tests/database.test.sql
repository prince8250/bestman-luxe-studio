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

-- Inserts a balanced paid sale directly (as the database owner), for report
-- tests on fixed past dates that create_sale would refuse (backdate limit).
-- p_items: [{"service": uuid|null, "name": text, "staff": uuid|null,
--            "list": int, "unit": int, "qty": int}]
create function pg_temp.add_sale(
  p_paid_at timestamptz, p_by uuid, p_customer uuid, p_items jsonb, p_payments jsonb,
  p_recorded_at timestamptz default null, p_backdated boolean default false, p_after_close boolean default false)
returns uuid language plpgsql as $$
declare
  v_id uuid;
  v_subtotal integer;
  v_discount integer;
  v_total integer;
  v_line jsonb;
  v_no integer := 0;
begin
  select coalesce(sum(greatest((l ->> 'list')::integer, (l ->> 'unit')::integer) * coalesce((l ->> 'qty')::integer, 1)), 0),
         coalesce(sum(greatest((l ->> 'list')::integer - (l ->> 'unit')::integer, 0) * coalesce((l ->> 'qty')::integer, 1)), 0),
         coalesce(sum((l ->> 'unit')::integer * coalesce((l ->> 'qty')::integer, 1)), 0)
    into v_subtotal, v_discount, v_total
    from jsonb_array_elements(p_items) l;
  insert into public.sales (customer_id, subtotal, discount_total, total, paid_at, recorded_at, is_backdated, after_close,
                            created_by, client_request_id)
  values (p_customer, v_subtotal, v_discount, v_total, p_paid_at, coalesce(p_recorded_at, p_paid_at), p_backdated, p_after_close,
          p_by, gen_random_uuid())
  returning id into v_id;
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_no := v_no + 1;
    insert into public.sale_items (sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price, quantity, line_total,
                                   price_override_reason)
    values (v_id, v_no, nullif(v_line ->> 'service', '')::uuid, v_line ->> 'name', nullif(v_line ->> 'staff', '')::uuid,
            (v_line ->> 'list')::integer, (v_line ->> 'unit')::integer, coalesce((v_line ->> 'qty')::integer, 1),
            (v_line ->> 'unit')::integer * coalesce((v_line ->> 'qty')::integer, 1),
            case when (v_line ->> 'list')::integer <> (v_line ->> 'unit')::integer then 'Test override' end);
  end loop;
  insert into public.sale_payments (sale_id, method, amount)
  select v_id, p ->> 'method', (p ->> 'amount')::integer from jsonb_array_elements(p_payments) p;
  return v_id;
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
  v_customer uuid;
  v_c1 uuid;
  v_c2 uuid;
  v_c3 uuid;
  v_s4 uuid;
  v_s5 uuid;
  v_d1 uuid;
  v_d4 uuid;
  v_report jsonb;
  v_alerts jsonb;
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

  -- The tests start from an open day. If today was really closed on this
  -- database, that close is set aside here (rolled back with everything else).
  update public.day_closes set reopened_at = now(), reopened_by = v_owner, reopen_reason = 'Test setup: start from an open day'
    where business_date = private.accra_today() and reopened_at is null;

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

  -- Customers (spec 13): two paid sales and one voided sale for one number.
  perform pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "customer_phone": "+233209999050", "customer_name": "Test Kojo",
      "payments": [{"method": "cash", "amount": 4500}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 1}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kofi));
  perform pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "customer_phone": "+233209999050",
      "payments": [{"method": "momo", "amount": 9000}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 2}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kwame));
  v_result := pg_temp.call_as(v_counter, format($q$
    select public.create_sale('{"client_request_id": "%s", "customer_phone": "+233209999050",
      "payments": [{"method": "cash", "amount": 4500}],
      "items": [{"service_id": "%s", "staff_id": "%s", "unit_price": 4500, "quantity": 1}]}'::jsonb)
  $q$, gen_random_uuid(), v_wash, v_kwame));
  perform pg_temp.run_as(v_owner, format($q$ select public.void_sale(%L, 'Test void') $q$, v_result ->> 'sale_id'));
  perform pg_temp.as_db_owner();
  select id into v_customer from public.customers where phone = '+233209999050';

  v_result := pg_temp.call_as(v_owner, format($q$ select public.customer_detail(%L) $q$, v_customer));
  perform pg_temp.expect((v_result -> 'stats' ->> 'visits')::integer = 2
    and (v_result -> 'stats' ->> 'total_spent')::integer = 13500
    and v_result -> 'favorite_service' ->> 'name' = 'Test wash' and (v_result -> 'favorite_service' ->> 'times')::integer = 3
    and v_result -> 'usual_staff' ->> 'name' is not null
    and jsonb_array_length(v_result -> 'sales') = 3,
    'customer_detail counts paid visits and spending only (the voided sale is listed but not counted)', left(v_result::text, 300));
  v_result := pg_temp.call_as(v_counter, format($q$ select public.customer_detail(%L) $q$, v_customer));
  perform pg_temp.expect((v_result -> 'stats' ->> 'visits')::integer = 2
    and v_result -> 'stats' -> 'total_spent' = 'null'::jsonb
    and not exists (select 1 from jsonb_array_elements(v_result -> 'sales') s where s ->> 'total' is not null),
    'the counter sees the visits but no money', left(v_result::text, 300));

  perform pg_temp.expect(
    (pg_temp.call_as(v_counter, $q$ select public.search_customers(null, '+233209999050') $q$) -> 'rows' -> 0 ->> 'visits')::integer = 2
    and (pg_temp.call_as(v_counter, $q$ select public.search_customers('020 999 9050') $q$) ->> 'count')::integer = 1
    and (pg_temp.call_as(v_counter, $q$ select public.search_customers('233209999050') $q$) ->> 'count')::integer = 1
    and (pg_temp.call_as(v_counter, $q$ select public.search_customers('9999050') $q$) ->> 'count')::integer = 1
    and (pg_temp.call_as(v_counter, $q$ select public.search_customers('test koj') $q$) ->> 'count')::integer = 1,
    'search_customers finds a customer by any common phone format, part of the number, or part of the name');
  perform pg_temp.expect(pg_temp.run_as(null, $q$ select public.search_customers('x') $q$) like 'permission denied%'
    and pg_temp.run_as(null, format($q$ select public.customer_detail(%L) $q$, v_customer)) like 'permission denied%',
    'visitors cannot search or open customers');

  perform pg_temp.run_as(v_owner, format($q$ update public.customers set blocked = true, blocked_reason = 'Two no-shows' where id = %L $q$, v_customer));
  v_result := pg_temp.call_as(v_counter, format($q$ select public.customer_detail(%L) $q$, v_customer));
  perform pg_temp.expect((v_result ->> 'blocked')::boolean and v_result ->> 'blocked_reason' = 'Two no-shows'
    and v_result -> 'blocked_by' ->> 'name' = 'Test Owner',
    'blocking a number is logged and shown on the customer with who blocked it', left(v_result::text, 300));
  v_message := pg_temp.run_as(v_counter, format($q$ update public.customers set full_name = 'Kojo Mensah', notes = 'Likes a low fade' where id = %L $q$, v_customer));
  perform pg_temp.as_db_owner();
  perform pg_temp.expect(v_message = 'OK' and (select full_name from public.customers where id = v_customer) = 'Kojo Mensah',
    'the counter can edit a customer''s name and notes', v_message);

  -- ---------------------------------------------------------------------------
  -- Report engine (spec 14), on a sample week no other data touches:
  -- Mon 3 Jan 2000 to Sun 9 Jan 2000 (Accra is UTC+0).
  --
  --   Previous week (27 Dec 1999 - 2 Jan 2000)
  --   P1 Thu 30 Dec  C2       cut  by Kofi   100.00  cash
  --   P2 Fri 31 Dec  walk-in  wash by Kwame   40.00  cash
  --   The week
  --   S1 Mon 10:00   C1       cut  by Kofi   100.00  cash          (rung by the counter)
  --   S2 Mon 15:00   walk-in  wash x2 Kwame   80.00  MoMo          (counter; 45.00 discounted to 40.00 each)
  --   S3 Wed 11:00   C2       cut  by Kwame  100.00 + hair oil 35.00 (custom, no staff); cash 100 + card 35; after close
  --   S4 Fri 18:00   C1       wash by Kofi    40.00  cash, then REASSIGNED to Kwame; a pending void request
  --   S5 Sat 12:00   C3       cut  by Kofi   100.00  cash, then VOIDED (counts nowhere)
  --   S6 Sun 23:59   C2       wash by Kofi    40.00  cash, entered Mon 10 Jan (backdated: lands on Sunday)
  --   S7 Mon 10 Jan 00:00 (next week)  walk-in  cut by Kofi  100.00 cash
  --   Day close for Mon 3 Jan: expected 300.00, counted 295.00, difference -5.00
  --
  -- Hand calculation for the week:
  --   revenue  = 100 + 80 + 135 + 40 + 40 = GHS 395.00; sales = 5; average = 79.00
  --   services = 1 + 2 + 1 + 1 + 1 = 6 (the hair oil is not a service)
  --   customers served = C1, C2 (C3 only on the voided sale) + 1 walk-in = 3
  --   cash = 100 + 100 + 40 + 40 = 280; MoMo 80; card 35 (adds up to 395)
  --   Kwame: S2 2 + S3 1 + S4 1 = 4 services, 80 + 100 + 40 = 220, average 55, top: wash (3)
  --   Kofi:  S1 1 + S6 1 = 2 services, 140, average 70, top: cut (tie on times, more revenue)
  --   repeat customers: C1 and C2 in the week; only C2 bought before it -> 1 / 2 = 0.5
  --   previous week: revenue 140, sales 2, services 2, customers 2 (C2 + 1 walk-in), average 70
  --   January 2000: 395 + 100 (S7) = 495; previous 31 days (December 1999) = 140
  -- ---------------------------------------------------------------------------
  perform pg_temp.as_db_owner();
  insert into public.customers (phone, full_name) values ('+233209998001', 'Report C1') returning id into v_c1;
  insert into public.customers (phone, full_name) values ('+233209998002', 'Report C2') returning id into v_c2;
  insert into public.customers (phone, full_name) values ('+233209998003', 'Report C3') returning id into v_c3;

  perform pg_temp.add_sale('1999-12-30 10:00+00', v_owner, v_c2,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  perform pg_temp.add_sale('1999-12-31 10:00+00', v_owner, null,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kwame, 'list', 4000, 'unit', 4000)),
    '[{"method": "cash", "amount": 4000}]');
  perform pg_temp.add_sale('2000-01-03 10:00+00', v_counter, v_c1,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  perform pg_temp.add_sale('2000-01-03 15:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kwame, 'list', 4500, 'unit', 4000, 'qty', 2)),
    '[{"method": "momo", "amount": 8000}]');
  perform pg_temp.add_sale('2000-01-05 11:00+00', v_owner, v_c2,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kwame, 'list', 10000, 'unit', 10000),
                      jsonb_build_object('name', 'Hair oil', 'list', 3500, 'unit', 3500)),
    '[{"method": "cash", "amount": 10000}, {"method": "card", "amount": 3500}]', null, false, true);
  v_s4 := pg_temp.add_sale('2000-01-07 18:00+00', v_owner, v_c1,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kofi, 'list', 4000, 'unit', 4000)),
    '[{"method": "cash", "amount": 4000}]');
  v_s5 := pg_temp.add_sale('2000-01-08 12:00+00', v_owner, v_c3,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  perform pg_temp.add_sale('2000-01-09 23:59:30+00', v_owner, v_c2,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kofi, 'list', 4000, 'unit', 4000)),
    '[{"method": "cash", "amount": 4000}]', '2000-01-10 08:00+00', true);
  perform pg_temp.add_sale('2000-01-10 00:00:30+00', v_owner, null,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  insert into public.void_requests (sale_id, requested_by, reason, created_at)
    values (v_s4, v_counter, 'Test request', '2000-01-07 19:00+00');
  insert into public.day_closes (business_date, opening_float, expected_cash, counted_cash, cash_difference,
                                 expected_momo, expected_card, sales_count, closed_by, closed_at)
    values ('2000-01-03', 20000, 30000, 29500, -500, 8000, 0, 2, v_counter, '2000-01-03 20:00+00');
  set constraints all immediate;
  set constraints all deferred;

  v_message := pg_temp.run_as(v_owner, format($q$ select public.reassign_sale_item_staff(
    (select id from public.sale_items where sale_id = %L), %L, 'Test reassign') $q$, v_s4, v_kwame));
  v_message := v_message || '/' || pg_temp.run_as(v_owner, format($q$ select public.void_sale(%L, 'Test void') $q$, v_s5));
  perform pg_temp.expect(v_message = 'OK/OK', 'report fixtures: S4 reassigned and S5 voided', v_message);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_summary('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report -> 'current' @> '{"revenue": 39500, "sales_count": 5, "services_count": 6, "customers_served": 3, "average_sale": 7900}'
    and v_report -> 'previous' @> '{"revenue": 14000, "sales_count": 2, "services_count": 2, "customers_served": 2, "average_sale": 7000}'
    and v_report ->> 'previous_from' = '1999-12-27' and v_report ->> 'previous_to' = '2000-01-02',
    'report_summary: the sample week and the week before match the hand calculation (voided sale excluded)', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_payment_method('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report = '[{"method": "cash", "amount": 28000, "sales_count": 4}, {"method": "momo", "amount": 8000, "sales_count": 1},
                                      {"method": "card", "amount": 3500, "sales_count": 1}, {"method": "other", "amount": 0, "sales_count": 0}]'::jsonb,
    'report_by_payment_method: cash 280, MoMo 80, card 35, adding up to the revenue', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_staff('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(
    v_report -> 0 @> jsonb_build_object('staff_id', v_kwame, 'services', 4, 'revenue', 22000, 'average_per_service', 5500,
                                        'top_service', jsonb_build_object('name', 'Test wash', 'times', 3))
    and v_report -> 1 @> jsonb_build_object('staff_id', v_kofi, 'services', 2, 'revenue', 14000, 'average_per_service', 7000,
                                            'top_service', jsonb_build_object('name', 'Test cut', 'times', 1))
    and jsonb_array_length(v_report) = 2,
    'report_by_staff: the reassigned line counts for Kwame only; the custom item has no staff', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_service('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report @> jsonb_build_array(
      jsonb_build_object('service_id', v_cut, 'times', 2, 'revenue', 20000, 'custom', false),
      jsonb_build_object('service_id', v_wash, 'times', 4, 'revenue', 16000, 'custom', false),
      '{"name": "Hair oil", "custom": true, "times": 1, "revenue": 3500, "category": "Custom items"}'::jsonb)
    and jsonb_array_length(v_report) = 3,
    'report_by_service: services by their own row, custom items apart', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_category('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report @> jsonb_build_array(
      jsonb_build_object('category_id', v_category, 'times', 6, 'revenue', 36000),
      '{"name": "Custom items", "times": 1, "revenue": 3500}'::jsonb)
    and jsonb_array_length(v_report) = 2,
    'report_by_category: the category and the custom items', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_channel('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report = '[{"channel": "walk_in", "sales_count": 5, "revenue": 39500},
                                      {"channel": "online_booking", "sales_count": 0, "revenue": 0},
                                      {"channel": "phone_booking", "sales_count": 0, "revenue": 0}]'::jsonb,
    'report_by_channel: every channel, with zeros', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_day('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(jsonb_array_length(v_report) = 7
    and v_report -> 0 = '{"date": "2000-01-03", "revenue": 18000, "sales_count": 2, "services_count": 3}'::jsonb
    and v_report -> 1 = '{"date": "2000-01-04", "revenue": 0, "sales_count": 0, "services_count": 0}'::jsonb
    and v_report -> 5 @> '{"date": "2000-01-08", "revenue": 0}'::jsonb
    and v_report -> 6 @> '{"date": "2000-01-09", "revenue": 4000, "sales_count": 1}'::jsonb,
    'report_by_day: one row per day; the voided Saturday is empty; the backdated 23:59 sale lands on Sunday', v_report::text);
  v_report := pg_temp.call_as(v_owner, $q$ select public.report_summary('2000-01-10', '2000-01-16') $q$);
  perform pg_temp.expect(v_report -> 'current' @> '{"revenue": 10000, "sales_count": 1}',
    'day and week boundaries: a sale at 00:00:30 on Monday belongs to the next week', v_report::text);
  v_report := pg_temp.call_as(v_owner, $q$ select public.report_summary('2000-01-01', '2000-01-31') $q$);
  perform pg_temp.expect(v_report -> 'current' @> '{"revenue": 49500, "sales_count": 6}'
    and v_report -> 'previous' @> '{"revenue": 14000}' and v_report ->> 'previous_from' = '1999-12-01',
    'month boundary: January 2000 against the previous 31 days (December 1999)', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_weekday('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report -> 0 @> '{"weekday": 1, "name": "Monday", "days": 1, "revenue": 18000}'
    and v_report -> 5 @> '{"weekday": 6, "name": "Saturday", "revenue": 0}' and jsonb_array_length(v_report) = 7,
    'report_by_weekday: Monday to Sunday with how many of each day the period has', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_repeat_customers('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report = '{"identified": 2, "repeat": 1, "rate": 0.5000}'::jsonb,
    'report_repeat_customers: 1 of 2 identified customers had bought before (hand-checked)', v_report::text);

  v_report := pg_temp.call_as(v_owner, $q$ select jsonb_build_object(
    'voids', public.report_voids('2000-01-03', '2000-01-09'),
    'backdated', public.report_backdated('2000-01-03', '2000-01-09'),
    'after_close', public.report_after_close('2000-01-03', '2000-01-09'),
    'requests', public.report_void_requests('2000-01-03', '2000-01-09'),
    'closes', public.report_day_close('2000-01-03', '2000-01-09')) $q$);
  perform pg_temp.expect(jsonb_array_length(v_report -> 'voids') = 1 and v_report -> 'voids' -> 0 ->> 'sale_id' = v_s5::text
    and (v_report -> 'voids' -> 0 ->> 'sold_in_period')::boolean and v_report -> 'voids' -> 0 ->> 'voided_by' = 'Test Owner'
    and jsonb_array_length(v_report -> 'backdated') = 1 and v_report -> 'backdated' -> 0 ->> 'business_date' = '2000-01-09'
    and jsonb_array_length(v_report -> 'after_close') = 1 and (v_report -> 'after_close' -> 0 ->> 'total')::integer = 13500
    and jsonb_array_length(v_report -> 'requests') = 1
    and v_report -> 'requests' -> 0 @> '{"status": "pending", "requested_by": "Test Counter", "reason": "Test request"}'
    and jsonb_array_length(v_report -> 'closes') = 1
    and v_report -> 'closes' -> 0 @> '{"business_date": "2000-01-03", "cash_difference": -500, "active": true}',
    'voids, backdated, after-close, void requests, and day closes for the week', left(v_report::text, 300));

  v_report := pg_temp.call_as(v_owner, $q$ select public.report_by_counter_user('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_report @> jsonb_build_array(jsonb_build_object(
      'user_id', v_counter, 'role', 'counter', 'sales_count', 2, 'revenue', 18000, 'overrides', 1, 'void_requests', 1)),
    'report_by_counter_user: the counter''s sales, revenue, overrides, and void requests', v_report::text);

  v_report := pg_temp.call_as(v_owner, format($q$ select public.report_changes('%s', '%s') $q$, private.accra_today(), private.accra_today()));
  perform pg_temp.expect(exists (select 1 from jsonb_array_elements(v_report -> 'rows') r
                                 where r ->> 'action' = 'staff_reassigned' and r ->> 'reason' = 'Test reassign'),
    'report_changes: today''s change log includes the reassignment', left(v_report::text, 300));

  -- Spec 16: the change log filtered by type and account, in SQL.
  v_report := pg_temp.call_as(v_owner, format($q$ select public.report_changes('%s', '%s', 500, array['staff_reassigned'], %L) $q$,
    private.accra_today(), private.accra_today(), v_owner));
  perform pg_temp.expect((v_report ->> 'count')::integer >= 1
    and not exists (select 1 from jsonb_array_elements(v_report -> 'rows') r
                    where r ->> 'action' <> 'staff_reassigned' or r ->> 'actor_name' <> 'Test Owner')
    and exists (select 1 from jsonb_array_elements(v_report -> 'rows') r where r ->> 'reason' = 'Test reassign'),
    'report_changes filters by type and account', left(v_report::text, 300));

  -- Spec 16: one staff member's report reflects the reassignment.
  v_report := pg_temp.call_as(v_owner, format($q$ select public.report_staff_detail(%L, '2000-01-03', '2000-01-09') $q$, v_kwame));
  perform pg_temp.expect((v_report ->> 'services')::integer = 4 and (v_report ->> 'revenue')::integer = 22000
    and jsonb_array_length(v_report -> 'lines') = 3
    and (v_report -> 'by_service') @> jsonb_build_array(jsonb_build_object('service_id', v_wash, 'times', 3, 'revenue', 12000))
    and (select count(*) from jsonb_array_elements(v_report -> 'lines') l where l ->> 'reassigned_from' = 'Test Kofi') = 1
    and jsonb_array_length(v_report -> 'by_day') = 7 and v_report -> 'by_day' -> 4 @> '{"date": "2000-01-07", "services": 1}',
    'report_staff_detail: Kwame''s week includes the line reassigned from Kofi, marked', left(v_report::text, 300));
  v_report := pg_temp.call_as(v_owner, format($q$ select public.report_staff_detail(%L, '2000-01-03', '2000-01-09') $q$, v_kofi));
  perform pg_temp.expect((v_report ->> 'services')::integer = 2 and (v_report ->> 'revenue')::integer = 14000
    and jsonb_array_length(v_report -> 'moved_away') = 1 and v_report -> 'moved_away' -> 0 ->> 'to_name' = 'Test Kwame',
    'report_staff_detail: Kofi''s week no longer counts the moved line and lists it as moved away', left(v_report::text, 300));
  perform pg_temp.expect(pg_temp.run_as(v_counter, format($q$ select public.report_staff_detail(%L, '2000-01-03', '2000-01-09') $q$, v_kofi)) = 'not_authorized'
    and pg_temp.run_as(v_owner, format($q$ select public.report_staff_detail(%L, '2000-01-03', '2000-01-09') $q$, gen_random_uuid())) = 'not_found',
    'report_staff_detail is owner-only and refuses an unknown staff member');

  -- The day report: the owner any day; the counter only after that day is closed.
  v_report := pg_temp.call_as(v_counter, $q$ select public.report_day_close_export('2000-01-03') $q$);
  perform pg_temp.expect(v_report -> 'figures' @> '{"revenue": 18000, "sales_count": 2}'
    and jsonb_array_length(v_report -> 'sales') = 2 and jsonb_array_length(v_report -> 'day_closes') = 1,
    'report_day_close_export: the counter gets the report of a closed day', left(v_report::text, 300));
  v_message := pg_temp.run_as(v_counter, $q$ select public.report_day_close_export('2000-01-05') $q$);
  perform pg_temp.expect(v_message = 'not_closed', 'report_day_close_export: the counter gets nothing for a day that is not closed', v_message);
  v_report := pg_temp.call_as(v_owner, $q$ select public.report_day_close_export('2000-01-05') $q$);
  perform pg_temp.expect(v_report -> 'figures' @> '{"revenue": 13500}', 'report_day_close_export: the owner gets any day', left(v_report::text, 300));

  -- ---------------------------------------------------------------------------
  -- Close day (spec 17) on Tue 1 Feb 2000, a day nothing else touches:
  --   D1 09:00  cut by Kofi    100.00 cash, then edited to 80.00 with 20.00 cash refunded
  --   D2 11:00  wash x2 Kwame   80.00 MoMo
  --   D3 14:00  cut by Kwame   100.00 card
  --   D4 16:00  wash by Kofi    40.00 cash, then VOIDED (counts nowhere)
  --   D5 17:00  cut by Kofi    100.00 cash
  -- Opening float 150.00 (not the default 200.00, so it needs a reason).
  -- Hand calculation: expected cash = 150 + 100 - 20 + 100 = 330.00; counted
  -- 325.00, so the difference is -5.00. MoMo 80.00, card 100.00, 4 sales.
  -- ---------------------------------------------------------------------------
  perform pg_temp.as_db_owner();
  v_d1 := pg_temp.add_sale('2000-02-01 09:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  perform pg_temp.add_sale('2000-02-01 11:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kwame, 'list', 4000, 'unit', 4000, 'qty', 2)),
    '[{"method": "momo", "amount": 8000}]');
  perform pg_temp.add_sale('2000-02-01 14:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kwame, 'list', 10000, 'unit', 10000)),
    '[{"method": "card", "amount": 10000}]');
  v_d4 := pg_temp.add_sale('2000-02-01 16:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_wash, 'name', 'Test wash', 'staff', v_kofi, 'list', 4000, 'unit', 4000)),
    '[{"method": "cash", "amount": 4000}]');
  perform pg_temp.add_sale('2000-02-01 17:00+00', v_counter, null,
    jsonb_build_array(jsonb_build_object('service', v_cut, 'name', 'Test cut', 'staff', v_kofi, 'list', 10000, 'unit', 10000)),
    '[{"method": "cash", "amount": 10000}]');
  set constraints all immediate;
  set constraints all deferred;

  v_message := pg_temp.run_as(v_owner, format($q$ select public.edit_sale_item((select id from public.sale_items where sale_id = %L),
    '{"unit_price": 8000}'::jsonb, '{"method": "cash", "amount": -2000}'::jsonb, 'Shorter cut, refunded') $q$, v_d1));
  v_message := v_message || '/' || pg_temp.run_as(v_owner, format($q$ select public.void_sale(%L, 'Test void') $q$, v_d4));
  perform pg_temp.expect(v_message = 'OK/OK', 'close day fixtures: D1 refunded 20.00 cash, D4 voided', v_message);

  perform pg_temp.as_db_owner();
  perform pg_temp.expect(private.unclosed_days('2000-02-03', 14) = '[{"business_date": "2000-02-01", "sales_count": 4}]'::jsonb
    and (private.day_status('2000-02-01') ->> 'open_since')::timestamptz = '2000-02-01 09:00+00'
    and private.day_status('2000-02-01') ->> 'closed_at' is null,
    'before the close: 1 Feb is listed as not closed (4 paid sales), open since its first sale',
    private.unclosed_days('2000-02-03', 14)::text || ' ' || private.day_status('2000-02-01')::text);

  v_close := pg_temp.call_as(v_counter, $q$
    select public.close_day('2000-02-01', 32500, 8000, 15000, 'Test close', 'Change for the morning') $q$);
  perform pg_temp.expect(
    v_close @> '{"opening_float": 15000, "expected_cash": 33000, "counted_cash": 32500, "cash_difference": -500,
                 "cash": 18000, "momo": 8000, "card": 10000, "momo_reported": 8000, "sales_count": 4}'
    and exists (select 1 from public.day_closes where id = (v_close ->> 'day_close_id')::uuid
                and expected_cash = 33000 and counted_cash = 32500 and cash_difference = -500
                and expected_momo = 8000 and expected_card = 10000 and sales_count = 4
                and opening_float_reason = 'Change for the morning' and closed_by = v_counter),
    'close_day on a day with cash, MoMo, card, a refund, and a void: expected 330.00, counted 325.00, difference -5.00 (hand-checked)',
    v_close::text);
  perform pg_temp.expect(
    exists (select 1 from public.owner_alerts where occurrence_key = 'cash_difference:' || (v_close ->> 'day_close_id')
            and (payload ->> 'cash_difference')::integer = -500)
    and exists (select 1 from public.owner_alerts where occurrence_key = 'day_summary:' || (v_close ->> 'day_close_id')
                and payload ->> 'business_date' = '2000-02-01'),
    'the close queues the day summary and, beyond the tolerance, a cash difference alert');

  perform pg_temp.as_db_owner();
  perform pg_temp.expect(private.unclosed_days('2000-02-03', 14) = '[]'::jsonb
    and private.day_status('2000-02-01') @> '{"closed_by": "Test Counter"}'
    and private.day_status('2000-02-01') ->> 'closed_at' is not null,
    'after the close: no day left open, and the status says who closed it and when',
    private.day_status('2000-02-01')::text);

  v_message := pg_temp.run_as(v_counter, $q$ select public.close_day('2000-02-01', 32500, null, null, null) $q$)
    || '/' || pg_temp.run_as(v_owner, $q$ select public.reopen_day('2000-02-01', '  ') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.reopen_day('2000-02-01', 'Recount') $q$);
  perform pg_temp.expect(v_message = 'already_closed/reason_required/not_authorized',
    'a closed day cannot be closed again; reopening needs a reason and the owner', v_message);
  v_message := pg_temp.run_as(v_owner, $q$ select public.reopen_day('2000-02-01', 'Recount the drawer') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.close_day('2000-02-01', 33000, 8000, 15000, null, 'Change for the morning') $q$);
  perform pg_temp.expect(v_message = 'OK/OK'
    and exists (select 1 from public.audit_log where action = 'day_reopened' and reason = 'Recount the drawer'
                and after ->> 'business_date' = '2000-02-01' and actor_id = v_owner)
    and (select count(*) from public.day_closes where business_date = '2000-02-01') = 2
    and (select count(*) from public.day_closes where business_date = '2000-02-01' and reopened_at is null and cash_difference = 0) = 1,
    'the owner reopens with a reason (logged), the day is closed again, and both closes stay in history', v_message);

  perform pg_temp.expect(pg_temp.run_as(v_counter, 'select public.unclosed_days()') = 'OK'
    and (pg_temp.call_as(v_counter, 'select public.day_status()') ->> 'business_date')::date = private.accra_today()
    and pg_temp.run_as(null, 'select public.unclosed_days()') like 'permission denied%'
    and pg_temp.run_as(null, 'select public.day_status()') like 'permission denied%'
    and pg_temp.run_as(v_counter, $q$ select private.unclosed_days('2000-02-03', 14) $q$) like 'permission denied%',
    'unclosed_days and day_status are for POS users only (dates and times, never money)');

  -- Owner only, and sane ranges.
  v_message := pg_temp.run_as(v_counter, $q$ select public.report_summary('2000-01-03', '2000-01-09') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.report_by_staff('2000-01-03', '2000-01-09') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.report_by_counter_user('2000-01-03', '2000-01-09') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.report_changes('2000-01-03', '2000-01-09') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.report_day_close('2000-01-03', '2000-01-09') $q$);
  perform pg_temp.expect(v_message = 'not_authorized/not_authorized/not_authorized/not_authorized/not_authorized',
    'every report function refuses a counter user', v_message);
  perform pg_temp.expect(pg_temp.run_as(null, $q$ select public.report_summary('2000-01-03', '2000-01-09') $q$) like 'permission denied%'
    and pg_temp.run_as(v_owner, $q$ select public.report_summary('2000-01-09', '2000-01-03') $q$) = 'invalid_input'
    and pg_temp.run_as(v_owner, $q$ select public.report_summary('2000-01-01', '2003-01-01') $q$) = 'invalid_input',
    'visitors are refused, and a backwards or over-long range is refused');
  perform pg_temp.expect(pg_temp.run_as(v_owner, $q$ select private.r_summary('2000-01-03', '2000-01-09') $q$) like 'permission denied%',
    'the private report builders cannot be called directly');

  -- ---------------------------------------------------------------------------
  -- Spec 19: the owner's activity feed
  -- ---------------------------------------------------------------------------
  perform pg_temp.as_db_owner();
  insert into public.sign_in_events (profile_id) values (v_counter);
  insert into public.backup_runs (kind, status, message) values ('daily_pc', 'failed', 'Test backup failure');

  v_report := pg_temp.call_as(v_owner, $q$ select public.activity_feed(null, 200) $q$);
  perform pg_temp.expect(
    exists (select 1 from jsonb_array_elements(v_report -> 'events') e
            where e ->> 'type' = 'sign_in' and e ->> 'actor_name' = 'Test Counter')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e
                where e ->> 'type' = 'backup_failed' and (e ->> 'unusual')::boolean and e #>> '{data,message}' = 'Test backup failure')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e
                where e ->> 'type' = 'staff_reassigned' and e #>> '{data,reason}' = 'Test reassign' and e ->> 'actor_name' = 'Test Owner')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e
                where e ->> 'type' = 'void_requested' and (e ->> 'unusual')::boolean and e ->> 'actor_name' = 'Test Counter')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e where e ->> 'type' = 'sale_voided')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e where e ->> 'type' = 'day_reopened')
    and exists (select 1 from jsonb_array_elements(v_report -> 'events') e
                where e ->> 'type' = 'sale' and e #>> '{data,receipt_no}' is not null and e ->> 'actor_name' is not null),
    'activity_feed: sales, reassignments, void requests, voids, reopened days, counter sign-ins, and failed backups, with who did each',
    left(v_report::text, 300));

  v_report := pg_temp.call_as(v_owner, format($q$ select public.activity_feed(null, 50, array['sign_ins'], %L) $q$, v_counter));
  perform pg_temp.expect(jsonb_array_length(v_report -> 'events') >= 1
    and not exists (select 1 from jsonb_array_elements(v_report -> 'events') e
                    where e ->> 'type' <> 'sign_in' or e ->> 'actor_id' <> v_counter::text),
    'activity_feed filters by type and by account', left(v_report::text, 300));
  v_report := pg_temp.call_as(v_owner, $q$ select public.activity_feed(null, 200, array['void_requests']) $q$);
  perform pg_temp.expect(jsonb_array_length(v_report -> 'events') >= 1
    and not exists (select 1 from jsonb_array_elements(v_report -> 'events') e where e ->> 'type' not like 'void_request%')
    and jsonb_typeof(v_report -> 'pending_requests') = 'array',
    'activity_feed: the void requests filter, and the pending requests list for the top of the page', left(v_report::text, 300));

  perform pg_temp.as_db_owner();
  update public.profiles set activity_seen_at = now() - interval '1 minute' where id = v_owner;
  v_count := (pg_temp.call_as(v_owner, 'select to_jsonb(public.activity_unread_count())') #>> '{}')::bigint;
  perform pg_temp.as_db_owner();
  update public.profiles set activity_seen_at = now() + interval '1 minute' where id = v_owner;
  perform pg_temp.expect(v_count >= 1
    and (pg_temp.call_as(v_owner, 'select to_jsonb(public.activity_unread_count())') #>> '{}')::bigint = 0,
    'activity_unread_count counts what happened since the owner last looked', v_count::text);

  v_message := pg_temp.run_as(v_counter, 'select public.activity_feed()')
    || '/' || pg_temp.run_as(v_counter, 'select public.activity_unread_count()')
    || '/' || pg_temp.run_as(v_owner, 'select private.activity_events(null, null, 10, null, null)');
  perform pg_temp.expect(v_message like 'not_authorized/not_authorized/permission denied%',
    'a counter user cannot read the feed, and nobody calls its private builder', v_message);

  -- ---------------------------------------------------------------------------
  -- Spec 19: sending owner alerts (the service role's sender). Earlier pending
  -- alerts are set aside so the counts below are exact.
  -- ---------------------------------------------------------------------------
  perform pg_temp.as_db_owner();
  update public.owner_alerts set sms_status = 'skipped' where sms_status = 'pending';
  update public.owner_alerts set sms_sent_at = null where sms_sent_at is not null;
  update public.studio_settings set owner_alert_phone = '+233257178639', daily_sms_cap = 2,
    alert_settings = alert_settings || '{"large_override": false}'::jsonb;
  perform private.create_owner_alert('large_override', null, '{"receipt_no": "T-0"}', 'test19:off');
  perform private.create_owner_alert('void_requested', null, '{"receipt_no": "T-1", "total": 1000}', 'test19:a');
  perform private.create_owner_alert('backdated_sale', null, '{"receipt_no": "T-2", "total": 2000}', 'test19:b');
  perform private.create_owner_alert('after_close_sale', null, '{"receipt_no": "T-3", "total": 3000}', 'test19:c');
  perform private.create_owner_alert('cash_difference', null, '{"cash_difference": -500}', 'test19:old');
  update public.owner_alerts set created_at = now() - interval '7 hours' where occurrence_key = 'test19:old';
  update public.owner_alerts set created_at = now() - interval '4 minutes' where occurrence_key = 'test19:off';
  update public.owner_alerts set created_at = now() - interval '3 minutes' where occurrence_key = 'test19:a';
  update public.owner_alerts set created_at = now() - interval '2 minutes' where occurrence_key = 'test19:b';
  update public.owner_alerts set created_at = now() - interval '1 minute' where occurrence_key = 'test19:c';

  v_alerts := public.claim_owner_alerts(20);
  perform pg_temp.expect(jsonb_array_length(v_alerts) = 2
    and v_alerts -> 0 ->> 'kind' = 'void_requested' and v_alerts -> 1 ->> 'kind' = 'backdated_sale'
    and v_alerts -> 0 ->> 'phone' = '+233257178639' and v_alerts -> 0 #>> '{payload,receipt_no}' = 'T-1'
    and (select sms_status from public.owner_alerts where occurrence_key = 'test19:off') = 'disabled'
    and (select sms_status || ':' || sms_error from public.owner_alerts where occurrence_key = 'test19:old') = 'skipped:Too old to send'
    and (select sms_status from public.owner_alerts where occurrence_key = 'test19:c') = 'throttled'
    and (select count(*) from public.owner_alerts where occurrence_key in ('test19:a', 'test19:b')
         and sms_status = 'failed' and sms_error = 'Sending') = 2,
    'claim_owner_alerts: oldest first up to the daily cap (2); switched-off kinds disabled, beyond the cap throttled, too old skipped',
    left(v_alerts::text, 300));
  perform pg_temp.expect(public.claim_owner_alerts(20) = '[]'::jsonb,
    'a second claim finds nothing: an alert is never sent twice');

  perform public.finish_owner_alert((v_alerts -> 0 ->> 'id')::uuid, true);
  perform public.finish_owner_alert((v_alerts -> 1 ->> 'id')::uuid, false, 'Arkesel: Insufficient balance');
  perform public.finish_owner_alert((v_alerts -> 0 ->> 'id')::uuid, false, 'Late duplicate result');
  perform pg_temp.expect(
    (select sms_status from public.owner_alerts where occurrence_key = 'test19:a' and sms_sent_at is not null and sms_error is null) = 'sent'
    and (select sms_status || ':' || sms_error from public.owner_alerts where occurrence_key = 'test19:b') = 'failed:Arkesel: Insufficient balance',
    'finish_owner_alert records sent or failed once; a late second result changes nothing');

  -- One SMS sent today and a cap of 2: the next alert goes, the one after is throttled.
  perform private.create_owner_alert('void_requested', null, '{"receipt_no": "T-4"}', 'test19:d');
  v_alerts := public.claim_owner_alerts(20);
  perform private.create_owner_alert('void_requested', null, '{"receipt_no": "T-5"}', 'test19:e');
  perform public.claim_owner_alerts(20);
  update public.studio_settings set owner_alert_phone = null;
  perform private.create_owner_alert('void_requested', null, '{"receipt_no": "T-6"}', 'test19:f');
  perform public.claim_owner_alerts(20);
  perform pg_temp.expect(jsonb_array_length(v_alerts) = 1 and v_alerts -> 0 #>> '{payload,receipt_no}' = 'T-4'
    and (select sms_status from public.owner_alerts where occurrence_key = 'test19:e') = 'throttled'
    and (select sms_status || ':' || sms_error from public.owner_alerts where occurrence_key = 'test19:f') = 'skipped:No owner phone in Settings',
    'the daily cap counts sent and in-flight SMS (failed ones do not); with no owner phone alerts stay in the feed only',
    left(v_alerts::text, 300));
  perform public.finish_owner_alert((v_alerts -> 0 ->> 'id')::uuid, true, 'Console: logged, not delivered');
  perform pg_temp.expect(
    (select sms_status || ':' || sms_error from public.owner_alerts where occurrence_key = 'test19:d') = 'sent:Console: logged, not delivered',
    'an alert handled in console or sandbox mode keeps a note that it was not delivered');

  -- The 23:30 checks. In the report week: Wed 5 Jan had a paid sale, no close,
  -- and no PC backup; Mon 3 Jan was closed and gets a backup here; Tue 4 Jan
  -- had no sales.
  insert into public.backup_runs (kind, status, created_at) values ('daily_pc', 'success', '2000-01-03 21:00+00');
  v_report := public.owner_daily_check('2000-01-05');
  v_report := public.owner_daily_check('2000-01-05');
  perform pg_temp.expect(
    v_report @> '{"sales_count": 1, "closed": false, "backup_ok": false}'
    and (select count(*) from public.owner_alerts
         where occurrence_key in ('day_not_closed:2000-01-05', 'backup_stale:2000-01-05')) = 2
    and (select payload @> '{"business_date": "2000-01-05", "revenue": 13500, "sales_count": 1}' from public.owner_alerts
         where occurrence_key = 'day_not_closed:2000-01-05'),
    'owner_daily_check: a day with sales, no close, and no backup queues day_not_closed (with the figures) and backup_stale once, even when run twice',
    v_report::text);
  perform pg_temp.expect(
    public.owner_daily_check('2000-01-03') @> '{"closed": true, "backup_ok": true, "alerts": []}'
    and public.owner_daily_check('2000-01-04') @> '{"sales_count": 0, "alerts": []}',
    'owner_daily_check: a closed day with a backup, and a day without sales, queue nothing');

  v_message := pg_temp.run_as(v_owner, 'select public.claim_owner_alerts()')
    || '/' || pg_temp.run_as(v_owner, $q$ select public.owner_daily_check('2000-01-05') $q$)
    || '/' || pg_temp.run_as(v_counter, $q$ select public.finish_owner_alert(gen_random_uuid(), true) $q$);
  perform pg_temp.expect(v_message like 'permission denied%/permission denied%/permission denied%',
    'only the server (service role) can claim, finish, or run the daily checks', v_message);

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
