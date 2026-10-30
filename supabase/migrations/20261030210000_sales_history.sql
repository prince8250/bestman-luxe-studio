-- =============================================================================
-- Sales history and sale detail (spec 10).
--
-- search_sales(filters) and sale_detail(sale_id) are security definer
-- functions that apply the sales visibility rule themselves
-- (private.can_see_sale: the owner sees every sale, the counter today's only),
-- so they can show what a counter user needs on today's sales (who rang a
-- sale, a colleague's pending void request) without opening those tables
-- wider. Money totals are returned to the owner only.
--
-- Also: receipt_data and record_receipt_print (spec 09) now use the existing
-- private.can_see_sale(date, timestamptz) helper, and the duplicate overload
-- added in 20261030200000 is dropped.
-- =============================================================================

create or replace function public.receipt_data(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  perform private.require_pos_user(array['owner', 'counter']);

  select * into v_sale from public.sales where id = p_sale_id;
  if not found or not private.can_see_sale(v_sale.business_date, v_sale.recorded_at) then
    raise exception 'not_found' using detail = 'That receipt was not found.';
  end if;

  return jsonb_build_object(
    'id', v_sale.id,
    'receipt_no', v_sale.receipt_no,
    'status', v_sale.status,
    'paid_at', v_sale.paid_at,
    'recorded_at', v_sale.recorded_at,
    'is_backdated', v_sale.is_backdated,
    'after_close', v_sale.after_close,
    'customer_name', v_sale.customer_name,
    'subtotal', v_sale.subtotal,
    'discount_total', v_sale.discount_total,
    'total', v_sale.total,
    'counter_name', (select p.display_name from public.profiles p where p.id = v_sale.created_by),
    'prints', (select count(*) from public.receipt_prints rp where rp.sale_id = v_sale.id),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'line_no', i.line_no,
               'name', i.item_name,
               'custom', i.service_id is null,
               'quantity', i.quantity,
               'list_price', i.list_price,
               'unit_price', i.unit_price,
               'line_total', i.line_total,
               'staff_id', i.staff_id,
               'staff_name', st.name)
             order by i.line_no)
      from public.sale_items i
      left join public.staff st on st.id = i.staff_id
      where i.sale_id = v_sale.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', sp.kind,
               'method', sp.method,
               'amount', sp.amount,
               'tendered', sp.tendered,
               'reference', sp.reference)
             order by sp.created_at, sp.id)
      from public.sale_payments sp
      where sp.sale_id = v_sale.id), '[]'::jsonb),
    'studio', (
      select jsonb_build_object(
               'name', s.studio_name,
               'address', s.address,
               'phone', s.phone,
               'whatsapp', s.whatsapp,
               'header', s.receipt_header,
               'footer', s.receipt_footer,
               'copies', s.receipt_copies,
               'social_links', s.social_links)
      from public.studio_settings s
      limit 1)
  );
end;
$$;

create or replace function public.record_receipt_print(p_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_sale public.sales;
  v_count integer;
begin
  select user_id into v_user from private.require_pos_user(array['owner', 'counter']);

  select * into v_sale from public.sales where id = p_sale_id;
  if not found or not private.can_see_sale(v_sale.business_date, v_sale.recorded_at) then
    raise exception 'not_found' using detail = 'That receipt was not found.';
  end if;

  insert into public.receipt_prints (sale_id, printed_by) values (p_sale_id, v_user);
  select count(*) into v_count from public.receipt_prints where sale_id = p_sale_id;
  return v_count;
end;
$$;

drop function private.can_see_sale(text, public.sales);

-- -----------------------------------------------------------------------------
-- search_sales: one page of sales plus the count and (owner only) totals for
-- everything that matches. Filters (all optional, jsonb):
--   from, to        business dates (YYYY-MM-DD), inclusive        [owner]
--   staff_id        a staff member on any line                      [owner]
--   method          cash | momo | card | other (any payment)        [owner]
--   channel         walk_in | online_booking | phone_booking        [owner]
--   recorded_by     the POS account that rang the sale              [owner]
--   status          paid | voided | void_requested
--   receipt_no      exact, for example BLS-000123
--   phone           exact, E.164
--   limit (1-100, default 50), offset (default 0)
-- The counter always gets today's sales only, without money (no totals and
-- no per-sale amounts), whatever filters are sent.
-- -----------------------------------------------------------------------------
create or replace function public.search_sales(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_owner boolean;
  v_from date;
  v_to date;
  v_staff uuid;
  v_method text;
  v_channel text;
  v_recorded_by uuid;
  v_status text := nullif(p_filters ->> 'status', '');
  v_receipt text := nullif(upper(trim(p_filters ->> 'receipt_no')), '');
  v_phone text := nullif(trim(p_filters ->> 'phone'), '');
  v_limit integer;
  v_offset integer;
  v_result jsonb;
begin
  select user_role into v_role from private.require_pos_user(array['owner', 'counter']);
  v_owner := v_role = 'owner';

  begin
    if v_owner then
      v_from := nullif(p_filters ->> 'from', '')::date;
      v_to := nullif(p_filters ->> 'to', '')::date;
      v_staff := nullif(p_filters ->> 'staff_id', '')::uuid;
      v_method := nullif(p_filters ->> 'method', '');
      v_channel := nullif(p_filters ->> 'channel', '');
      v_recorded_by := nullif(p_filters ->> 'recorded_by', '')::uuid;
    end if;
    v_limit := least(greatest(coalesce((p_filters ->> 'limit')::integer, 50), 1), 100);
    v_offset := greatest(coalesce((p_filters ->> 'offset')::integer, 0), 0);
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid_input' using detail = 'One of the filters is not valid.';
  end;
  if v_status is not null and v_status not in ('paid', 'voided', 'void_requested') then
    raise exception 'invalid_input' using detail = 'One of the filters is not valid.';
  end if;

  with visible as (
    select s.*,
           exists (select 1 from public.void_requests vr where vr.sale_id = s.id and vr.status = 'pending') as void_requested
    from public.sales s
    where private.can_see_sale(s.business_date, s.recorded_at)
      and (v_from is null or s.business_date >= v_from)
      and (v_to is null or s.business_date <= v_to)
      and (v_channel is null or s.channel = v_channel)
      and (v_recorded_by is null or s.created_by = v_recorded_by)
      and (v_receipt is null or s.receipt_no = v_receipt)
      and (v_phone is null or s.customer_phone = v_phone)
      and (v_staff is null or exists (
            select 1 from public.sale_items i where i.sale_id = s.id and i.staff_id = v_staff))
      and (v_method is null or exists (
            select 1 from public.sale_payments sp where sp.sale_id = s.id and sp.method = v_method and sp.kind = 'payment'))
  ),
  matched as (
    select * from visible v
    where v_status is null
       or (v_status = 'void_requested' and v.void_requested)
       or (v_status in ('paid', 'voided') and v.status = v_status)
  ),
  page as (
    select * from matched
    order by paid_at desc, receipt_no desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'count', (select count(*) from matched),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'receipt_no', p.receipt_no,
               'paid_at', p.paid_at,
               'recorded_at', p.recorded_at,
               'status', p.status,
               'void_requested', p.void_requested,
               'total', case when v_owner then p.total end,
               'customer_name', p.customer_name,
               'customer_phone', p.customer_phone,
               'channel', p.channel,
               'is_backdated', p.is_backdated,
               'after_close', p.after_close,
               'recorded_by', (select pr.display_name from public.profiles pr where pr.id = p.created_by),
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object('name', i.item_name, 'quantity', i.quantity, 'staff_name', st.name)
                                  order by i.line_no)
                 from public.sale_items i
                 left join public.staff st on st.id = i.staff_id
                 where i.sale_id = p.id), '[]'::jsonb),
               'methods', coalesce((
                 select jsonb_agg(distinct sp.method)
                 from public.sale_payments sp
                 where sp.sale_id = p.id and sp.kind = 'payment'), '[]'::jsonb))
             order by p.paid_at desc, p.receipt_no desc)
      from page p), '[]'::jsonb),
    'totals', case when v_owner then (
      select jsonb_build_object(
        'sales', count(*) filter (where m.status = 'paid'),
        'revenue', coalesce(sum(m.total) filter (where m.status = 'paid'), 0),
        'discounts', coalesce(sum(m.discount_total) filter (where m.status = 'paid'), 0),
        'voided', count(*) filter (where m.status = 'voided'),
        'voided_amount', coalesce(sum(m.total) filter (where m.status = 'voided'), 0),
        -- Money collected per method on the paid sales (adjustments
        -- included), so the methods add up to the revenue.
        'by_method', coalesce((
          select jsonb_object_agg(x.method, x.amount)
          from (
            select sp.method, sum(sp.amount) as amount
            from public.sale_payments sp
            join matched mm on mm.id = sp.sale_id and mm.status = 'paid'
            group by sp.method
          ) x), '{}'::jsonb))
      from matched m)
    end
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- sale_detail: everything the sale page shows, read from stored data. The
-- change history (audit_log) is returned to the owner only.
-- -----------------------------------------------------------------------------
create or replace function public.sale_detail(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_role text;
  v_sale public.sales;
begin
  select user_id, user_role into v_user, v_role from private.require_pos_user(array['owner', 'counter']);

  select * into v_sale from public.sales where id = p_sale_id;
  if not found or not private.can_see_sale(v_sale.business_date, v_sale.recorded_at) then
    raise exception 'not_found' using detail = 'That sale was not found.';
  end if;

  return jsonb_build_object(
    'id', v_sale.id,
    'receipt_no', v_sale.receipt_no,
    'status', v_sale.status,
    'channel', v_sale.channel,
    'paid_at', v_sale.paid_at,
    'recorded_at', v_sale.recorded_at,
    'business_date', v_sale.business_date,
    'is_backdated', v_sale.is_backdated,
    'after_close', v_sale.after_close,
    'subtotal', v_sale.subtotal,
    'discount_total', v_sale.discount_total,
    'total', v_sale.total,
    'note', v_sale.note,
    'customer_id', v_sale.customer_id,
    'customer_name', v_sale.customer_name,
    'customer_phone', v_sale.customer_phone,
    'recorded_by', (select p.display_name from public.profiles p where p.id = v_sale.created_by),
    'voided_at', v_sale.voided_at,
    'voided_by', (select p.display_name from public.profiles p where p.id = v_sale.voided_by),
    'void_reason', v_sale.void_reason,
    'prints', (select count(*) from public.receipt_prints rp where rp.sale_id = v_sale.id),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'line_no', i.line_no,
               'name', i.item_name,
               'custom', i.service_id is null,
               'quantity', i.quantity,
               'list_price', i.list_price,
               'unit_price', i.unit_price,
               'line_total', i.line_total,
               'reason', i.price_override_reason,
               'staff_name', st.name)
             order by i.line_no)
      from public.sale_items i
      left join public.staff st on st.id = i.staff_id
      where i.sale_id = v_sale.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', sp.kind,
               'method', sp.method,
               'amount', sp.amount,
               'tendered', sp.tendered,
               'reference', sp.reference,
               'created_at', sp.created_at)
             order by sp.created_at, sp.id)
      from public.sale_payments sp
      where sp.sale_id = v_sale.id), '[]'::jsonb),
    'appointment', (
      select jsonb_build_object(
               'code', a.code,
               'starts_at', a.starts_at,
               'source', a.source,
               'service_name', sv.name,
               'staff_name', st.name)
      from public.appointments a
      left join public.services sv on sv.id = a.service_id
      left join public.staff st on st.id = a.staff_id
      where a.id = v_sale.appointment_id),
    'void_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', vr.id,
               'status', vr.status,
               'reason', vr.reason,
               'requested_by', rq.display_name,
               'mine', vr.requested_by = v_user,
               'created_at', vr.created_at,
               'decided_by', dc.display_name,
               'decided_at', vr.decided_at,
               'decision_note', vr.decision_note)
             order by vr.created_at desc)
      from public.void_requests vr
      left join public.profiles rq on rq.id = vr.requested_by
      left join public.profiles dc on dc.id = vr.decided_by
      where vr.sale_id = v_sale.id), '[]'::jsonb),
    'history', case when v_role = 'owner' then coalesce((
      select jsonb_agg(jsonb_build_object(
               'action', a.action,
               'actor_name', a.actor_name,
               'actor_role', a.actor_role,
               'before', a.before,
               'after', a.after,
               'reason', a.reason,
               'created_at', a.created_at)
             order by a.created_at, a.id)
      from public.audit_log a
      where (a.entity = 'sale' and a.entity_id = v_sale.id)
         or (a.entity = 'sale_item' and a.entity_id in (select i.id from public.sale_items i where i.sale_id = v_sale.id))
         or (a.entity = 'void_request' and a.entity_id in (select vr.id from public.void_requests vr where vr.sale_id = v_sale.id))
      ), '[]'::jsonb)
    end
  );
end;
$$;

revoke execute on function public.search_sales(jsonb) from public, anon;
revoke execute on function public.sale_detail(uuid) from public, anon;
grant execute on function public.search_sales(jsonb) to authenticated;
grant execute on function public.sale_detail(uuid) to authenticated;
