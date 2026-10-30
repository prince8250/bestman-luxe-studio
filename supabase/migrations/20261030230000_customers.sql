-- =============================================================================
-- Customers (spec 13).
--
-- A counter user can only read today's sales (RLS), so they cannot count a
-- customer's visits themselves. These two security definer functions return
-- the history for both POS roles; money (total spent and sale amounts) is
-- returned to the owner only. Visits and totals count paid sales only
-- (voided sales never count).
-- =============================================================================

-- search_customers: one page of customers matching a name or phone, most
-- recent visit first. p_phone is an exact E.164 number (any common Ghana
-- format already turned into E.164 by the app); p_query matches part of the
-- name or the digits of the number (0244..., 233244..., or 4565866).
create or replace function public.search_customers(
  p_query text default null,
  p_phone text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_phone text := nullif(trim(p_phone), '');
  v_digits text;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  perform private.require_pos_user(array['owner', 'counter']);
  if v_query is not null and length(v_query) > 80 then
    raise exception 'invalid_input' using detail = 'The search is too long.';
  end if;

  -- The digits of a phone typed in any common way, without the leading 0 or 233.
  v_digits := regexp_replace(coalesce(v_query, ''), '\D', '', 'g');
  if v_digits like '233%' then
    v_digits := substr(v_digits, 4);
  elsif v_digits like '0%' then
    v_digits := substr(v_digits, 2);
  end if;
  if length(v_digits) < 3 then
    v_digits := null;
  end if;

  with matched as (
    select c.*,
           (select count(*) from public.sales s where s.customer_id = c.id and s.status = 'paid') as visits,
           (select max(s.paid_at) from public.sales s where s.customer_id = c.id and s.status = 'paid') as last_visit
    from public.customers c
    where (v_phone is null or c.phone = v_phone)
      and (v_query is null
           or c.full_name ilike '%' || replace(replace(v_query, '%', ''), '_', '') || '%'
           or (v_digits is not null and c.phone like '%' || v_digits || '%'))
  ),
  page as (
    select * from matched
    order by last_visit desc nulls last, created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'count', (select count(*) from matched),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'phone', p.phone,
               'full_name', p.full_name,
               'blocked', p.blocked,
               'visits', p.visits,
               'last_visit', p.last_visit)
             order by p.last_visit desc nulls last, p.created_at desc)
      from page p), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- customer_detail: one customer with their history.
create or replace function public.customer_detail(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_owner boolean;
  v_customer public.customers;
begin
  select user_role into v_role from private.require_pos_user(array['owner', 'counter']);
  v_owner := v_role = 'owner';

  select * into v_customer from public.customers where id = p_customer_id;
  if not found then
    raise exception 'not_found' using detail = 'That customer was not found.';
  end if;

  return jsonb_build_object(
    'id', v_customer.id,
    'phone', v_customer.phone,
    'full_name', v_customer.full_name,
    'notes', v_customer.notes,
    'blocked', v_customer.blocked,
    'blocked_reason', v_customer.blocked_reason,
    -- Who blocked the number and when (from the change log).
    'blocked_by', case when v_customer.blocked then (
      select jsonb_build_object('name', a.actor_name, 'at', a.created_at)
      from public.audit_log a
      where a.entity = 'customer' and a.entity_id = v_customer.id and a.action = 'customer_blocked'
      order by a.created_at desc, a.id desc
      limit 1) end,
    'created_at', v_customer.created_at,
    'stats', (
      select jsonb_build_object(
               'visits', count(*),
               'first_visit', min(s.paid_at),
               'last_visit', max(s.paid_at),
               'total_spent', case when v_owner then coalesce(sum(s.total), 0) end)
      from public.sales s
      where s.customer_id = v_customer.id and s.status = 'paid'),
    -- The service they have most often (service lines on paid sales).
    'favorite_service', (
      select jsonb_build_object('name', (array_agg(i.item_name order by s.paid_at desc))[1], 'times', sum(i.quantity))
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      where s.customer_id = v_customer.id and s.status = 'paid' and i.service_id is not null
      group by i.service_id
      order by sum(i.quantity) desc, max(s.paid_at) desc
      limit 1),
    -- The staff member who has served them most often.
    'usual_staff', (
      select jsonb_build_object('name', st.name, 'times', count(*))
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      join public.staff st on st.id = i.staff_id
      where s.customer_id = v_customer.id and s.status = 'paid'
      group by st.id, st.name
      order by count(*) desc, max(s.paid_at) desc
      limit 1),
    'sales', coalesce((
      select jsonb_agg(x.row order by x.paid_at desc)
      from (
        select s.paid_at, jsonb_build_object(
                 'id', s.id,
                 'receipt_no', s.receipt_no,
                 'paid_at', s.paid_at,
                 'status', s.status,
                 'total', case when v_owner then s.total end,
                 -- A counter user can open today's sales only.
                 'can_open', private.can_see_sale(s.business_date, s.recorded_at),
                 'items', coalesce((
                   select jsonb_agg(jsonb_build_object('name', i.item_name, 'quantity', i.quantity, 'staff_name', st.name)
                                    order by i.line_no)
                   from public.sale_items i
                   left join public.staff st on st.id = i.staff_id
                   where i.sale_id = s.id), '[]'::jsonb)) as row
        from public.sales s
        where s.customer_id = v_customer.id
        order by s.paid_at desc
        limit 50
      ) x), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(x.row order by x.starts_at desc)
      from (
        select a.starts_at, jsonb_build_object(
                 'id', a.id,
                 'code', a.code,
                 'starts_at', a.starts_at,
                 'status', a.status,
                 'source', a.source,
                 'service_name', sv.name,
                 'staff_name', st.name) as row
        from public.appointments a
        left join public.services sv on sv.id = a.service_id
        left join public.staff st on st.id = a.staff_id
        where a.customer_id = v_customer.id
        order by a.starts_at desc
        limit 50
      ) x), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.search_customers(text, text, integer, integer) from public, anon;
revoke execute on function public.customer_detail(uuid) from public, anon;
grant execute on function public.search_customers(text, text, integer, integer) to authenticated;
grant execute on function public.customer_detail(uuid) to authenticated;
