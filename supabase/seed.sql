-- =============================================================================
-- SAMPLE DATA — DEVELOPMENT ONLY. NEVER LOAD INTO PRODUCTION.
--
-- Fills an empty database with clearly labeled sample data so every screen and
-- report has something to show:
--   - sample studio settings (marked "(sample)")
--   - the studio's real categories and services, with PLACEHOLDER prices and
--     durations (the owner sets the real ones in POS Services)
--   - 4 sample staff (Kofi, Kwame, Ama, Efua) with hours and services
--   - 2 sample offers, 10 gallery rows (photos uploaded by npm run db:seed)
--   - 18 sample customers with fake 020 000 01xx numbers
--   - about two weeks of sample sales, day closes, and appointments
--     (only when POS users exist; run npm run db:seed, which creates the test
--     owner and counter first)
--
-- Every row created here is recorded in private.sample_rows. Remove it all
-- before real use with:   select public.remove_sample_data();
--
-- Run it with: npm run db:seed   (or: npx supabase db query --linked -f supabase/seed.sql)
-- It refuses to run when the database already has staff or services.
-- =============================================================================

do $seed$
declare
  v_owner uuid;
  v_counter uuid;
  v_today date := private.accra_today();
  c_hair uuid;
  c_style uuid;
  c_face uuid;
  c_nails uuid;
  c_makeup uuid;
  s_kofi uuid;
  s_kwame uuid;
  s_ama uuid;
  s_efua uuid;
  v_day date;
  v_count integer;
  v_i integer;
  v_line integer;
  v_lines integer;
  v_paid_at timestamptz;
  v_recorded_at timestamptz;
  v_svc record;
  v_staff uuid;
  v_customer public.customers;
  v_sale uuid;
  v_item uuid;
  v_total integer;
  v_unit integer;
  v_reason text;
  v_roll double precision;
  v_cash integer;
  v_figures jsonb;
  v_expected integer;
  v_counted integer;
  v_close uuid;
  v_appt uuid;
  v_slot timestamptz;
  v_first_sale_of_day boolean;
  v_last_sale uuid;
  v_float constant integer := 20000;
begin
  if exists (select 1 from public.staff) or exists (select 1 from public.services) then
    raise notice 'The database already has staff or services. Sample data was NOT loaded.';
    return;
  end if;

  perform setseed(0.4242);

  select id into v_owner from public.profiles where role = 'owner' and active order by created_at limit 1;
  select id into v_counter from public.profiles where role = 'counter' and active order by created_at limit 1;

  -- ---------------------------------------------------------------------------
  -- Studio settings (sample values; the real ones are open question 1)
  -- ---------------------------------------------------------------------------
  update public.studio_settings set
    studio_name = 'Bestman Luxe Studio',
    phone = '+233200000000',
    whatsapp = '+233200000000',
    address = 'Asafo, near KsTU, Kumasi (sample address)',
    map_url = 'https://www.google.com/maps/search/?api=1&query=Asafo+Kumasi',
    opening_hours = '[
      {"day": "Monday", "hours": "08:00 – 20:00"},
      {"day": "Tuesday", "hours": "08:00 – 20:00"},
      {"day": "Wednesday", "hours": "08:00 – 20:00"},
      {"day": "Thursday", "hours": "08:00 – 20:00"},
      {"day": "Friday", "hours": "08:00 – 21:00"},
      {"day": "Saturday", "hours": "08:00 – 21:00"},
      {"day": "Sunday", "hours": "12:00 – 18:00"}
    ]'::jsonb,
    social_links = '{"instagram": "https://www.instagram.com/", "tiktok": "https://www.tiktok.com/"}'::jsonb,
    about_text = '(sample) Bestman Luxe Studio is a barbering and beauty studio in Kumasi. Sharp cuts, clean styling, and care for your skin and nails, all under one roof.',
    receipt_header = 'Bestman Luxe Studio',
    receipt_footer = 'Thank you for visiting! (sample footer)',
    default_opening_float = v_float;

  -- ---------------------------------------------------------------------------
  -- Categories and services: the studio's real list, placeholder prices.
  -- ---------------------------------------------------------------------------
  insert into public.service_categories (name, tagline, sort_order)
    values ('Haircuts & Barbering', 'Sharp cuts, clean lines', 1) returning id into c_hair;
  insert into public.service_categories (name, tagline, sort_order)
    values ('Hair Styling & Installation', 'Frontals, wigs, and weaves done right', 2) returning id into c_style;
  insert into public.service_categories (name, tagline, sort_order)
    values ('Facial & Skincare', 'Fresh, glowing skin', 3) returning id into c_face;
  insert into public.service_categories (name, tagline, sort_order)
    values ('Nails & Pedicure', 'Polished from tip to toe', 4) returning id into c_nails;
  insert into public.service_categories (name, tagline, sort_order)
    values ('Makeup & Beauty Enhancements', 'Ready for every occasion', 5) returning id into c_makeup;

  -- weight = how often the sample sales pick this service.
  create temp table seed_services (name text primary key, weight double precision) on commit drop;

  with rows (category_id, name, price, minutes, sort_order, online, weight) as (
    values
      (c_hair, 'Haircuts', 5000, 45, 1, true, 10.0),
      (c_hair, 'P-Cut', 6000, 45, 2, true, 6.0),
      (c_hair, 'Boy Child Fringe', 3000, 30, 3, true, 4.0),
      (c_style, 'Frontal Pony', 25000, 120, 1, true, 1.0),
      (c_style, 'Frontal Styling', 20000, 90, 2, true, 1.2),
      (c_style, 'Wig Installation', 30000, 120, 3, true, 1.2),
      (c_style, 'Weavon', 15000, 120, 4, true, 1.5),
      (c_style, 'Weavon Styling', 12000, 60, 5, true, 1.5),
      (c_style, 'Hair Washing', 4000, 30, 6, false, 3.0),
      (c_face, 'Facial', 15000, 60, 1, true, 1.5),
      (c_face, 'Contour', 10000, 45, 2, true, 0.8),
      (c_face, 'Eyebrow Tattoo', 35000, 90, 3, true, 0.5),
      (c_nails, 'Nail Services', 8000, 60, 1, true, 3.0),
      (c_nails, 'Gel Polish', 10000, 45, 2, true, 2.5),
      (c_nails, 'Acrylic Nails', 20000, 90, 3, true, 2.0),
      (c_nails, 'Pedicure', 12000, 60, 4, true, 2.0),
      (c_makeup, 'Makeup', 25000, 90, 1, true, 1.0),
      (c_makeup, 'Eyelashes', 15000, 60, 2, true, 1.5),
      (c_makeup, 'Piercing', 8000, 30, 3, true, 0.8)
  ),
  inserted as (
    insert into public.services (category_id, name, description, price, duration_minutes, sort_order, bookable_online)
    select category_id, name, '(sample) Placeholder price and duration. Set the real ones in POS Services.',
           price, minutes, sort_order, online
    from rows
    returning name
  )
  insert into seed_services (name, weight)
  select r.name, r.weight from rows r join inserted i on i.name = r.name;

  -- ---------------------------------------------------------------------------
  -- Sample staff
  -- ---------------------------------------------------------------------------
  insert into public.staff (name, title, bio, sort_order)
    values ('Kofi', 'Barber', '(sample) Sample staff member. Replace with the real team in POS Staff.', 1) returning id into s_kofi;
  insert into public.staff (name, title, bio, sort_order)
    values ('Kwame', 'Barber', '(sample) Sample staff member. Replace with the real team in POS Staff.', 2) returning id into s_kwame;
  insert into public.staff (name, title, bio, sort_order)
    values ('Ama', 'Hair Stylist', '(sample) Sample staff member. Replace with the real team in POS Staff.', 3) returning id into s_ama;
  insert into public.staff (name, title, bio, sort_order)
    values ('Efua', 'Nail & Beauty Tech', '(sample) Sample staff member. Replace with the real team in POS Staff.', 4) returning id into s_efua;

  insert into public.service_staff (service_id, staff_id)
    select id, s_kofi from public.services where name in ('Haircuts', 'P-Cut', 'Boy Child Fringe', 'Hair Washing');
  insert into public.service_staff (service_id, staff_id)
    select id, s_kwame from public.services where name in ('Haircuts', 'P-Cut', 'Boy Child Fringe');
  insert into public.service_staff (service_id, staff_id)
    select id, s_ama from public.services
    where category_id = c_style or name in ('Makeup', 'Eyelashes');
  insert into public.service_staff (service_id, staff_id)
    select id, s_efua from public.services
    where category_id in (c_face, c_nails) or name in ('Makeup', 'Eyelashes', 'Piercing');

  -- Hours (ISO weekday: 1 = Monday ... 7 = Sunday)
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    select s_kofi, d, '08:00', '20:00' from generate_series(1, 6) as d;
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    select s_kwame, d, '09:00', '20:00' from generate_series(1, 6) as d;
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    select s_kwame, 7, '12:00', '18:00';
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    select s_ama, d, '09:00', '19:00' from generate_series(2, 7) as d;
  -- Efua works a split day on Saturdays.
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    select s_efua, d, '09:00', '18:00' from generate_series(1, 5) as d;
  insert into public.staff_hours (staff_id, weekday, start_time, end_time)
    values (s_efua, 6, '09:00', '13:00'), (s_efua, 6, '15:00', '19:00');

  insert into public.staff_time_off (staff_id, starts_on, ends_on, reason)
    values (s_kwame, v_today + 9, v_today + 10, '(sample) Family event');

  -- ---------------------------------------------------------------------------
  -- Offers and gallery (photos are uploaded to the gallery bucket by
  -- npm run db:seed under sample/; studio-08 shows a child and is left out
  -- until the parent's permission is confirmed).
  -- ---------------------------------------------------------------------------
  insert into public.offers (title, description, service_id, starts_on, ends_on, sort_order)
    select '(sample) Midweek fresh cut', 'Haircut and wash for GHS 80 on Tuesdays and Wednesdays.', id, v_today - 3, v_today + 30, 1
    from public.services where name = 'Haircuts';
  insert into public.offers (title, description, service_id, starts_on, ends_on, sort_order)
    select '(sample) Bridal glam', 'Makeup and eyelashes for the big day. Ask at the studio.', id, null, null, 2
    from public.services where name = 'Makeup';

  insert into public.gallery_images (path, caption, sort_order)
  values
    ('sample/studio-04.jpg', 'Fade and line-up with beard', 1),
    ('sample/studio-02.jpg', 'Long nails with red and white art', 2),
    ('sample/studio-01.jpg', 'Short natural cut', 3),
    ('sample/studio-09.jpg', 'Fade and full beard', 4),
    ('sample/studio-06.jpg', 'Almond nails in dark red', 5),
    ('sample/studio-03.jpg', 'Short coloured curls', 6),
    ('sample/studio-07.jpg', 'Locs with a carved design', 7),
    ('sample/studio-05.jpg', 'Short cut with a shaved heart', 8),
    ('sample/studio-10.jpg', 'At work in the studio', 9),
    ('sample/studio-11.jpg', 'Beard and taper', 10);

  -- ---------------------------------------------------------------------------
  -- Sample customers (fake numbers 020 000 0101 ... 0118)
  -- ---------------------------------------------------------------------------
  insert into public.customers (phone, full_name, notes)
  select '+2332000001' || lpad(n::text, 2, '0'), name, '(sample customer)'
  from unnest(array[
    'Akosua Mensah', 'Yaw Boateng', 'Abena Owusu', 'Kojo Asante', 'Esi Appiah', 'Kwesi Darko',
    'Adwoa Frimpong', 'Nana Ofori', 'Afia Sarpong', 'Kwabena Ampofo', 'Akua Danso', 'Fiifi Quaye',
    'Efia Badu', 'Kobby Addo', 'Maame Yeboah', 'Selorm Agbeko', 'Delali Kumah', 'Edem Tetteh'
  ]) with ordinality as t(name, n);

  -- ---------------------------------------------------------------------------
  -- Sales, day closes, and appointments need a POS user to be "created by".
  -- ---------------------------------------------------------------------------
  if v_owner is null and v_counter is null then
    raise notice 'No POS users yet: sample sales, appointments, and day closes were skipped. Run npm run db:seed, which creates the test users first.';
  else
    v_owner := coalesce(v_owner, v_counter);
    v_counter := coalesce(v_counter, v_owner);

    for v_day in select d::date from generate_series(v_today - 13, v_today, interval '1 day') as d loop
      -- Today only gets sales if the day has started.
      if v_day = v_today and extract(hour from now() at time zone 'Africa/Accra') < 10 then
        continue;
      end if;

      v_count := case when v_day = v_today then 3 else 6 + floor(random() * 8)::integer end;
      v_first_sale_of_day := true;

      for v_i in 1..v_count loop
        if v_day = v_today then
          v_paid_at := now() - make_interval(mins => (v_count - v_i + 1) * 35);
        else
          v_paid_at := (v_day + time '09:00') at time zone 'Africa/Accra'
                       + make_interval(mins => (v_i - 1) * (630 / v_count) + floor(random() * 20)::integer);
        end if;
        v_recorded_at := v_paid_at;

        -- About two in three sales have a known customer.
        v_customer := null;
        if random() < 0.65 then
          select * into v_customer from public.customers order by random() limit 1;
        end if;

        insert into public.sales (customer_id, customer_name, customer_phone, channel, subtotal, discount_total, total,
                                  paid_at, recorded_at, created_by, client_request_id)
        values (v_customer.id, v_customer.full_name, v_customer.phone, 'walk_in', 0, 0, 0,
                v_paid_at, v_recorded_at, case when random() < 0.85 then v_counter else v_owner end, gen_random_uuid())
        returning id into v_sale;

        v_lines := case when random() < 0.25 then 2 else 1 end;
        for v_line in 1..v_lines loop
          -- Weighted pick: popular services come up more often.
          select sv.* into v_svc
          from public.services sv join seed_services w on w.name = sv.name
          order by -ln(greatest(random(), 1e-9)) / w.weight
          limit 1;
          select ss.staff_id into v_staff from public.service_staff ss where ss.service_id = v_svc.id order by random() limit 1;

          v_unit := v_svc.price;
          v_reason := null;
          if random() < 0.05 then
            v_unit := (v_svc.price * 0.9)::integer;
            v_reason := 'Regular customer discount';
          end if;

          insert into public.sale_items (sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price,
                                         quantity, line_total, price_override_reason, duration_minutes)
          values (v_sale, v_line, v_svc.id, v_svc.name, v_staff, v_svc.price, v_unit, 1, v_unit, v_reason, v_svc.duration_minutes)
          returning id into v_item;

          if v_reason is not null then
            insert into public.audit_log (actor_id, actor_name, actor_role, entity, entity_id, action, before, after, reason, created_at)
            values (v_counter, (select display_name from public.profiles where id = v_counter), 'counter', 'sale_item', v_item,
                    'item_price_overridden', jsonb_build_object('list_price', v_svc.price),
                    jsonb_build_object('unit_price', v_unit, 'quantity', 1, 'item_name', v_svc.name, 'sale_id', v_sale),
                    v_reason, v_paid_at);
          end if;
        end loop;

        -- An occasional custom item (a product sold at the counter).
        if random() < 0.04 then
          insert into public.sale_items (sale_id, line_no, item_name, list_price, unit_price, quantity, line_total, price_override_reason)
          values (v_sale, v_lines + 1, 'Hair oil (sample product)', 3500, 3500, 1, 3500, 'Product sold at the counter');
        end if;

        v_total := private.recompute_sale_totals(v_sale);

        -- Payments: mostly cash or MoMo, some card, a few split.
        v_roll := random();
        if v_roll < 0.08 and v_total >= 2000 then
          v_cash := (v_total / 2 / 100) * 100;
          insert into public.sale_payments (sale_id, method, amount, tendered, created_by)
            values (v_sale, 'cash', v_cash, v_cash, v_counter);
          insert into public.sale_payments (sale_id, method, amount, reference, created_by)
            values (v_sale, 'momo', v_total - v_cash, 'MP' || lpad(floor(random() * 1e8)::text, 8, '0'), v_counter);
        elsif v_roll < 0.58 then
          insert into public.sale_payments (sale_id, method, amount, tendered, created_by)
            values (v_sale, 'cash', v_total, ((v_total + 999) / 1000) * 1000, v_counter);
        elsif v_roll < 0.9 then
          insert into public.sale_payments (sale_id, method, amount, reference, created_by)
            values (v_sale, 'momo', v_total, 'MP' || lpad(floor(random() * 1e8)::text, 8, '0'), v_counter);
        else
          insert into public.sale_payments (sale_id, method, amount, created_by)
            values (v_sale, 'card', v_total, v_counter);
        end if;

        -- On a few past days the first customer came from an online booking.
        if v_first_sale_of_day and v_day in (v_today - 9, v_today - 5, v_today - 2) and v_customer.id is not null then
          select i.service_id, i.staff_id, sv.duration_minutes, sv.price into v_svc
            from public.sale_items i join public.services sv on sv.id = i.service_id
            where i.sale_id = v_sale order by i.line_no limit 1;
          insert into public.appointments (code, public_token, customer_id, customer_name, customer_phone, service_id,
                                           staff_id, starts_at, ends_at, status, source, quoted_price, sale_id,
                                           sms_status, created_at, seen_at)
          values (private.generate_booking_code(), encode(extensions.gen_random_bytes(24), 'hex'),
                  v_customer.id, v_customer.full_name, v_customer.phone, v_svc.service_id, v_svc.staff_id,
                  v_paid_at, v_paid_at + make_interval(mins => v_svc.duration_minutes), 'arrived', 'web',
                  v_svc.price, v_sale, 'sent', v_paid_at - interval '2 days', v_paid_at - interval '2 days')
          returning id into v_appt;
          update public.sales set appointment_id = v_appt, channel = 'online_booking' where id = v_sale;
        end if;

        v_first_sale_of_day := false;
        v_last_sale := v_sale;
      end loop;

      -- A voided sale four days ago (entered twice by mistake).
      if v_day = v_today - 4 then
        update public.sales set status = 'voided', voided_at = v_paid_at + interval '5 minutes',
                                voided_by = v_owner, void_reason = 'Entered twice by mistake'
          where id = v_last_sale;
        insert into public.audit_log (actor_id, actor_name, actor_role, entity, entity_id, action, before, after, reason, created_at)
        values (v_owner, (select display_name from public.profiles where id = v_owner), 'owner', 'sale', v_last_sale,
                'sale_voided', jsonb_build_object('status', 'paid'), jsonb_build_object('status', 'voided'),
                'Entered twice by mistake', v_paid_at + interval '5 minutes');
      end if;

      -- A reassignment two days ago: Kofi was busy, Kwame did the cut.
      if v_day = v_today - 2 then
        select i.id into v_item from public.sale_items i
          join public.sales s on s.id = i.sale_id
          where s.business_date = v_day and i.staff_id = s_kofi and s.status = 'paid'
          limit 1;
        if v_item is not null then
          update public.sale_items set staff_id = s_kwame where id = v_item;
          insert into public.audit_log (actor_id, actor_name, actor_role, entity, entity_id, action, before, after, reason, created_at)
          values (v_counter, (select display_name from public.profiles where id = v_counter), 'counter', 'sale_item', v_item,
                  'staff_reassigned', jsonb_build_object('staff_id', s_kofi, 'staff_name', 'Kofi'),
                  jsonb_build_object('staff_id', s_kwame, 'staff_name', 'Kwame'), 'Staff was busy',
                  (v_day + time '18:00') at time zone 'Africa/Accra');
        end if;
      end if;

      -- Close every past day: counted cash matches, except on two days.
      if v_day < v_today then
        v_figures := private.day_figures(v_day);
        v_expected := v_float + (v_figures ->> 'cash')::integer;
        v_counted := v_expected + case when v_day = v_today - 3 then -1500 when v_day = v_today - 8 then 500 else 0 end;
        insert into public.day_closes (business_date, opening_float, expected_cash, counted_cash, cash_difference,
                                       momo_reported, expected_momo, expected_card, expected_other, sales_count,
                                       note, closed_by, closed_at)
        values (v_day, v_float, v_expected, v_counted, v_counted - v_expected,
                (v_figures ->> 'momo')::integer, (v_figures ->> 'momo')::integer, (v_figures ->> 'card')::integer,
                (v_figures ->> 'other')::integer, (v_figures ->> 'sales_count')::integer,
                case when v_counted <> v_expected then '(sample) Counted twice' end,
                v_counter, (v_day + time '20:40') at time zone 'Africa/Accra')
        returning id into v_close;
        if v_counted <> v_expected then
          insert into public.owner_alerts (kind, payload, sms_status, created_at)
          values ('cash_difference', jsonb_build_object('business_date', v_day, 'expected_cash', v_expected,
                  'counted_cash', v_counted, 'cash_difference', v_counted - v_expected, 'sample', true),
                  'skipped', (v_day + time '20:40') at time zone 'Africa/Accra');
        end if;
      end if;
    end loop;

    -- A backdated sale: written on paper six days ago, entered the next morning.
    select * into v_customer from public.customers order by random() limit 1;
    select sv.* into v_svc from public.services sv where sv.name = 'Haircuts';
    v_paid_at := ((v_today - 6) + time '13:15') at time zone 'Africa/Accra';
    insert into public.sales (customer_id, customer_name, customer_phone, channel, subtotal, discount_total, total,
                              paid_at, recorded_at, is_backdated, created_by, client_request_id, note)
    values (v_customer.id, v_customer.full_name, v_customer.phone, 'walk_in', 0, 0, 0, v_paid_at,
            ((v_today - 5) + time '09:10') at time zone 'Africa/Accra', true, v_counter, gen_random_uuid(),
            '(sample) Written on the paper sheet during a power cut')
    returning id into v_sale;
    insert into public.sale_items (sale_id, line_no, service_id, item_name, staff_id, list_price, unit_price, quantity, line_total, duration_minutes)
    values (v_sale, 1, v_svc.id, v_svc.name, s_kofi, v_svc.price, v_svc.price, 1, v_svc.price, v_svc.duration_minutes);
    perform private.recompute_sale_totals(v_sale);
    insert into public.sale_payments (sale_id, method, amount, tendered, created_by)
    values (v_sale, 'cash', v_svc.price, v_svc.price, v_counter);
    insert into public.audit_log (actor_id, actor_name, actor_role, entity, entity_id, action, after, created_at)
    values (v_counter, (select display_name from public.profiles where id = v_counter), 'counter', 'sale', v_sale,
            'sale_backdated', jsonb_build_object('paid_at', v_paid_at, 'total', v_svc.price),
            ((v_today - 5) + time '09:10') at time zone 'Africa/Accra');
    insert into public.owner_alerts (kind, sale_id, payload, sms_status, created_at)
    values ('backdated_sale', v_sale, jsonb_build_object('total', v_svc.price, 'paid_at', v_paid_at, 'sample', true),
            'skipped', ((v_today - 5) + time '09:10') at time zone 'Africa/Accra');

    -- A pending void request on the most recent sale.
    select s.id into v_sale from public.sales s where s.status = 'paid' order by s.paid_at desc limit 1;
    insert into public.void_requests (sale_id, requested_by, reason, created_at)
    values (v_sale, v_counter, '(sample) Customer changed their mind before the service', now() - interval '20 minutes');

    -- Past appointments that did not become sales.
    select * into v_customer from public.customers order by random() limit 1;
    select sv.* into v_svc from public.services sv where sv.name = 'Gel Polish';
    v_slot := ((v_today - 3) + time '11:00') at time zone 'Africa/Accra';
    insert into public.appointments (code, public_token, customer_id, customer_name, customer_phone, service_id, staff_id,
                                     starts_at, ends_at, status, source, quoted_price, sms_status, cancel_reason,
                                     cancelled_by, cancelled_at, created_at, seen_at)
    values (private.generate_booking_code(), encode(extensions.gen_random_bytes(24), 'hex'), v_customer.id,
            v_customer.full_name, v_customer.phone, v_svc.id, s_efua, v_slot,
            v_slot + make_interval(mins => v_svc.duration_minutes), 'cancelled', 'web', v_svc.price, 'sent',
            '(sample) Customer called to cancel', v_counter, v_slot - interval '3 hours',
            v_slot - interval '1 day', v_slot - interval '1 day');

    select * into v_customer from public.customers order by random() limit 1;
    select sv.* into v_svc from public.services sv where sv.name = 'P-Cut';
    v_slot := ((v_today - 1) + time '15:00') at time zone 'Africa/Accra';
    insert into public.appointments (code, public_token, customer_id, customer_name, customer_phone, service_id, staff_id,
                                     starts_at, ends_at, status, source, quoted_price, sms_status, created_at, seen_at)
    values (private.generate_booking_code(), encode(extensions.gen_random_bytes(24), 'hex'), v_customer.id,
            v_customer.full_name, v_customer.phone, v_svc.id, s_kwame, v_slot,
            v_slot + make_interval(mins => v_svc.duration_minutes), 'no_show', 'web', v_svc.price, 'sent',
            v_slot - interval '2 days', v_slot - interval '2 days');

    -- Upcoming confirmed appointments over the next few days.
    for v_i in 1..6 loop
      select * into v_customer from public.customers order by random() limit 1;
      v_day := v_today + 1 + (v_i - 1) / 2;
      -- Keep Sunday bookings with staff who work Sundays.
      if extract(isodow from v_day) = 7 then
        select sv.* into v_svc from public.services sv where sv.name = 'Weavon Styling';
        v_staff := s_ama;
      elsif v_i % 3 = 1 then
        select sv.* into v_svc from public.services sv where sv.name = 'Haircuts';
        v_staff := s_kofi;
      elsif v_i % 3 = 2 then
        select sv.* into v_svc from public.services sv where sv.name = 'Acrylic Nails';
        v_staff := s_efua;
        if extract(isodow from v_day) = 6 then
          v_staff := s_efua;
        end if;
      else
        select sv.* into v_svc from public.services sv where sv.name = 'Wig Installation';
        v_staff := s_ama;
      end if;
      if v_staff = s_ama and extract(isodow from v_day) = 1 then
        -- Ama does not work Mondays.
        v_day := v_day + 1;
      end if;
      v_slot := (v_day + case when v_i % 2 = 1 then time '10:00' else time '14:30' end) at time zone 'Africa/Accra';
      insert into public.appointments (code, public_token, customer_id, customer_name, customer_phone, service_id, staff_id,
                                       staff_preference, starts_at, ends_at, status, source, quoted_price, sms_status,
                                       created_by, created_at, seen_at)
      values (private.generate_booking_code(), encode(extensions.gen_random_bytes(24), 'hex'), v_customer.id,
              v_customer.full_name, v_customer.phone, v_svc.id, v_staff,
              case when v_i = 2 then 'any' else 'specific' end, v_slot,
              v_slot + make_interval(mins => v_svc.duration_minutes), 'confirmed',
              case when v_i = 3 then 'phone' else 'web' end, v_svc.price,
              case when v_i = 3 then 'skipped' else 'sent' end,
              case when v_i = 3 then v_counter end,
              now() - make_interval(hours => 7 - v_i),
              case when v_i >= 5 then null else now() - make_interval(hours => 6 - v_i) end);
    end loop;
  end if;

  -- ---------------------------------------------------------------------------
  -- Register every sample row (the database was empty before this script).
  -- ---------------------------------------------------------------------------
  insert into private.sample_rows (table_name, row_id)
    select 'service_categories', id from public.service_categories
    union all select 'services', id from public.services
    union all select 'staff', id from public.staff
    union all select 'offers', id from public.offers
    union all select 'gallery_images', id from public.gallery_images
    union all select 'customers', id from public.customers
    union all select 'sales', id from public.sales
    union all select 'appointments', id from public.appointments
    union all select 'day_closes', id from public.day_closes
    union all select 'owner_alerts', id from public.owner_alerts
  on conflict do nothing;

  raise notice 'Sample data loaded: % services, % staff, % customers, % sales, % appointments, % day closes.',
    (select count(*) from public.services), (select count(*) from public.staff), (select count(*) from public.customers),
    (select count(*) from public.sales), (select count(*) from public.appointments), (select count(*) from public.day_closes);
end
$seed$;
