-- =============================================================================
-- Reports pages (spec 16): two additions to the report engine (spec 14).
--
-- 1. report_changes gains filters (actions, account), applied in SQL so the
--    row limit never hides matching rows.
-- 2. report_staff_detail: one staff member's work in a period (services,
--    revenue, by service, by day, their lines with reassignments marked, and
--    the lines moved away from them).
-- Both owner-only, through private.report_guard.
-- =============================================================================

drop function public.report_changes(date, date, integer);
drop function private.r_changes(date, date, integer);

-- audit_log rows written in the period, newest first (at most p_limit), for
-- the given actions (null = all) and account (null = everyone).
create or replace function private.r_changes(p_from date, p_to date, p_limit integer, p_actions text[], p_actor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with rows as (
    select * from public.audit_log a
    where a.created_at >= private.accra_day_start(p_from) and a.created_at < private.accra_day_start(p_to + 1)
      and (p_actions is null or a.action = any (p_actions))
      and (p_actor_id is null or a.actor_id = p_actor_id)
  )
  select jsonb_build_object(
    'count', (select count(*) from rows),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'created_at', r.created_at,
               'actor_name', r.actor_name,
               'actor_role', r.actor_role,
               'entity', r.entity,
               'entity_id', r.entity_id,
               'action', r.action,
               'before', r.before,
               'after', r.after,
               'reason', r.reason)
             order by r.created_at desc, r.id desc)
      from (select * from rows order by created_at desc, id desc limit least(greatest(coalesce(p_limit, 500), 1), 2000)) r),
      '[]'::jsonb)
  )
$$;

create or replace function public.report_changes(
  p_from date,
  p_to date,
  p_limit integer default 500,
  p_actions text[] default null,
  p_actor_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.report_guard(p_from, p_to);
  return private.r_changes(p_from, p_to, p_limit, p_actions, p_actor_id);
end;
$$;

-- One staff member's work in the period. Lines are service lines and custom
-- items assigned to them now (a reassigned line belongs to whoever has it
-- now, as in report_by_staff); "reassigned_from" marks a line that was moved
-- to them, and "moved_away" lists lines moved from them to someone else.
create or replace function private.r_staff_detail(p_staff_id uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select i.id, i.sale_id, i.service_id, i.item_name, i.quantity, i.line_total, i.unit_price, i.list_price,
           s.receipt_no, s.paid_at, s.business_date
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    where s.status = 'paid' and s.business_date between p_from and p_to and i.staff_id = p_staff_id
  ),
  services as (
    select * from lines where service_id is not null
  ),
  moves_in as (
    -- The latest reassignment of each line to this staff member.
    select distinct on (a.entity_id) a.entity_id as item_id, a.before ->> 'staff_name' as from_name,
           a.actor_name, a.reason, a.created_at
    from public.audit_log a
    where a.entity = 'sale_item' and a.action = 'staff_reassigned' and a.after ->> 'staff_id' = p_staff_id::text
      and a.entity_id in (select id from lines)
    order by a.entity_id, a.created_at desc, a.id desc
  ),
  moves_out as (
    select distinct on (a.entity_id) a.entity_id as item_id, a.after ->> 'staff_name' as to_name,
           a.actor_name, a.reason, a.created_at
    from public.audit_log a
    where a.entity = 'sale_item' and a.action = 'staff_reassigned' and a.before ->> 'staff_id' = p_staff_id::text
    order by a.entity_id, a.created_at desc, a.id desc
  )
  select jsonb_build_object(
    'staff', (select jsonb_build_object('id', st.id, 'name', st.name, 'title', st.title, 'active', st.active)
              from public.staff st where st.id = p_staff_id),
    'services', coalesce((select sum(quantity) from services), 0),
    'revenue', coalesce((select sum(line_total) from services), 0),
    'average_per_service', case when coalesce((select sum(quantity) from services), 0) > 0
      then round((select sum(line_total) from services)::numeric / (select sum(quantity) from services))::bigint else 0 end,
    'custom_revenue', coalesce((select sum(line_total) from lines where service_id is null), 0),
    'by_service', coalesce((
      select jsonb_agg(jsonb_build_object('service_id', x.service_id, 'name', x.name, 'times', x.times, 'revenue', x.revenue)
                       order by x.times desc, x.revenue desc, x.name)
      from (
        select l.service_id, coalesce(sv.name, max(l.item_name)) as name, sum(l.quantity) as times, sum(l.line_total) as revenue
        from services l left join public.services sv on sv.id = l.service_id
        group by l.service_id, sv.name
      ) x), '[]'::jsonb),
    'by_day', (
      select jsonb_agg(jsonb_build_object(
               'date', d.day::date,
               'services', coalesce((select sum(quantity) from services where business_date = d.day::date), 0),
               'revenue', coalesce((select sum(line_total) from services where business_date = d.day::date), 0))
             order by d.day)
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d(day)),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_id', l.id,
               'sale_id', l.sale_id,
               'receipt_no', l.receipt_no,
               'paid_at', l.paid_at,
               'name', l.item_name,
               'custom', l.service_id is null,
               'quantity', l.quantity,
               'line_total', l.line_total,
               'price_changed', l.unit_price <> l.list_price,
               'reassigned_from', m.from_name,
               'reassigned_by', m.actor_name,
               'reassign_reason', m.reason)
             order by l.paid_at, l.receipt_no)
      from lines l left join moves_in m on m.item_id = l.id), '[]'::jsonb),
    'moved_away', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_id', i.id,
               'sale_id', s.id,
               'receipt_no', s.receipt_no,
               'paid_at', s.paid_at,
               'name', i.item_name,
               'line_total', i.line_total,
               'to_name', m.to_name,
               'moved_by', m.actor_name,
               'reason', m.reason,
               'moved_at', m.created_at)
             order by s.paid_at, s.receipt_no)
      from moves_out m
      join public.sale_items i on i.id = m.item_id
      join public.sales s on s.id = i.sale_id
      where s.status = 'paid' and s.business_date between p_from and p_to and i.staff_id is distinct from p_staff_id), '[]'::jsonb)
  )
$$;

create or replace function public.report_staff_detail(p_staff_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.report_guard(p_from, p_to);
  if not exists (select 1 from public.staff where id = p_staff_id) then
    raise exception 'not_found' using detail = 'That staff member was not found.';
  end if;
  return private.r_staff_detail(p_staff_id, p_from, p_to);
end;
$$;

revoke execute on function private.r_changes(date, date, integer, text[], uuid) from public, anon, authenticated;
revoke execute on function private.r_staff_detail(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.report_changes(date, date, integer, text[], uuid) from public, anon;
revoke execute on function public.report_staff_detail(uuid, date, date) from public, anon;
grant execute on function public.report_changes(date, date, integer, text[], uuid) to authenticated;
grant execute on function public.report_staff_detail(uuid, date, date) to authenticated;
