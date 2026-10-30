-- =============================================================================
-- Changed sales (spec 11).
--
-- A line is "changed" when it has a staff reassignment, a price change, or a
-- service change in audit_log (written by reassign_sale_item_staff and
-- edit_sale_item in the same transaction as the change). search_sales and
-- sale_detail now return that flag for the "Changed" badge, and the line and
-- staff ids the sales list needs for its quick "Change staff" action.
-- =============================================================================

create or replace function private.line_changed(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.audit_log a
    where a.entity = 'sale_item' and a.entity_id = p_item_id
      and a.action in ('staff_reassigned', 'item_price_changed', 'item_service_changed'))
$$;

create or replace function private.sale_changed(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sale_items i where i.sale_id = p_sale_id and private.line_changed(i.id))
$$;

revoke execute on function private.line_changed(uuid) from public, anon, authenticated;
revoke execute on function private.sale_changed(uuid) from public, anon, authenticated;

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
               'business_date', p.business_date,
               'status', p.status,
               'void_requested', p.void_requested,
               'changed', private.sale_changed(p.id),
               'total', case when v_owner then p.total end,
               'customer_name', p.customer_name,
               'customer_phone', p.customer_phone,
               'channel', p.channel,
               'is_backdated', p.is_backdated,
               'after_close', p.after_close,
               'recorded_by', (select pr.display_name from public.profiles pr where pr.id = p.created_by),
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.item_name, 'quantity', i.quantity,
                                                     'staff_id', i.staff_id, 'staff_name', st.name)
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
    'changed', private.sale_changed(v_sale.id),
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
               'service_id', i.service_id,
               'staff_id', i.staff_id,
               'staff_name', st.name,
               'changed', private.line_changed(i.id))
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
