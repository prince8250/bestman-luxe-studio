-- =============================================================================
-- Report engine (spec 14).
--
-- Every number in the POS comes from these functions, so the dashboard, the
-- Reports pages, the CSV files, and the PC day report always agree.
--
-- Shape: private.r_*(from, to) build one report (no access check; never
-- granted to anyone). public.report_*(from, to) check that the caller is the
-- owner and that the range is sane, then return the private result.
-- report_day_close_export(date) is the one exception: a counter user may call
-- it for a day that has an active close (after the blind count).
--
-- Rules (architecture-context.md, invariants 3 and 4):
-- * Revenue comes only from paid (not voided) sales, by business_date, which
--   is the Accra date of paid_at (set by the sales_business_date trigger). A
--   backdated sale therefore lands on the day it really happened.
-- * "Services done" are service lines (sale_items with a service_id), counted
--   by quantity. Custom items (products, extras) count as revenue but not as
--   services.
-- * Money is integer pesewas; averages are rounded to whole pesewas.
-- * Dates are inclusive business dates in Africa/Accra.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Guards and small helpers
-- -----------------------------------------------------------------------------

-- The UTC instant a business date starts (local midnight in Accra).
create or replace function private.accra_day_start(p_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date::timestamp at time zone 'Africa/Accra')
$$;

-- Owner only, and a range of at most two years.
create or replace function private.report_guard(p_from date, p_to date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_pos_user(array['owner']);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_input' using detail = 'Choose a start date on or before the end date.';
  end if;
  if p_to - p_from > 731 then
    raise exception 'invalid_input' using detail = 'Choose a period of at most two years.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Builders (private)
-- -----------------------------------------------------------------------------

-- Revenue, sales, services done, customers served, and average sale.
-- Customers served = distinct identified customers + paid sales without a
-- phone (each walk-in without a number counts as one customer).
create or replace function private.r_figures(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select id, total, customer_id from public.sales
    where status = 'paid' and business_date between p_from and p_to
  ),
  t as (
    select coalesce(sum(total), 0)::bigint as revenue, count(*) as sales_count from s
  )
  select jsonb_build_object(
    'revenue', t.revenue,
    'sales_count', t.sales_count,
    'services_count', coalesce((
      select sum(i.quantity) from public.sale_items i join s on s.id = i.sale_id where i.service_id is not null), 0),
    'customers_served', (select count(distinct customer_id) from s) + (select count(*) from s where customer_id is null),
    'average_sale', case when t.sales_count > 0 then round(t.revenue::numeric / t.sales_count)::bigint else 0 end,
    'discounts', coalesce((
      select sum(x.discount_total) from public.sales x
      where x.status = 'paid' and x.business_date between p_from and p_to), 0)
  )
  from t
$$;

-- The figures for the period and for the previous period of the same length
-- (for a week, the week before; for 1-31 March, 29 January to 28 February).
create or replace function private.r_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'previous_from', p_from - (p_to - p_from + 1),
    'previous_to', p_from - 1,
    'current', private.r_figures(p_from, p_to),
    'previous', private.r_figures(p_from - (p_to - p_from + 1), p_from - 1)
  )
$$;

-- Money per payment method on the paid sales (adjustments included, so the
-- methods add up to the revenue). Every method is listed, with zeros.
create or replace function private.r_by_payment_method(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object(
           'method', m.method,
           'amount', coalesce(x.amount, 0),
           'sales_count', coalesce(x.sales_count, 0))
         order by m.ord)
  from (values ('cash', 1), ('momo', 2), ('card', 3), ('other', 4)) as m(method, ord)
  left join (
    select p.method,
           sum(p.amount)::bigint as amount,
           count(distinct p.sale_id) filter (where p.kind = 'payment') as sales_count
    from public.sale_payments p
    join public.sales s on s.id = p.sale_id
    where s.status = 'paid' and s.business_date between p_from and p_to
    group by p.method
  ) x on x.method = m.method
$$;

-- Each service (current name and category), and each custom item by name.
create or replace function private.r_by_service(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row order by revenue desc, name), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'service_id', i.service_id,
             'name', coalesce(sv.name, max(i.item_name)),
             'category', case when i.service_id is null then 'Custom items' else cat.name end,
             'custom', i.service_id is null,
             'times', sum(i.quantity),
             'revenue', sum(i.line_total)) as row,
           sum(i.line_total) as revenue,
           coalesce(sv.name, max(i.item_name)) as name
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    left join public.services sv on sv.id = i.service_id
    left join public.service_categories cat on cat.id = sv.category_id
    where s.status = 'paid' and s.business_date between p_from and p_to
    group by i.service_id, sv.name, cat.name, case when i.service_id is null then i.item_name end
  ) rows
$$;

-- Each category (current category of the service); custom items as one row.
create or replace function private.r_by_category(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row order by revenue desc, name), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'category_id', cat.id,
             'name', coalesce(cat.name, 'Custom items'),
             'custom', i.service_id is null,
             'times', sum(i.quantity),
             'revenue', sum(i.line_total)) as row,
           sum(i.line_total) as revenue,
           coalesce(cat.name, 'Custom items') as name
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    left join public.services sv on sv.id = i.service_id
    left join public.service_categories cat on cat.id = sv.category_id
    where s.status = 'paid' and s.business_date between p_from and p_to
    group by cat.id, cat.name, i.service_id is null
  ) rows
$$;

-- Walk-in, online booking, phone booking (every channel, with zeros).
create or replace function private.r_by_channel(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object(
           'channel', c.channel,
           'sales_count', coalesce(x.sales_count, 0),
           'revenue', coalesce(x.revenue, 0))
         order by c.ord)
  from (values ('walk_in', 1), ('online_booking', 2), ('phone_booking', 3)) as c(channel, ord)
  left join (
    select channel, count(*) as sales_count, sum(total)::bigint as revenue
    from public.sales
    where status = 'paid' and business_date between p_from and p_to
    group by channel
  ) x on x.channel = c.channel
$$;

-- Per staff member: services done (service lines by quantity), the revenue of
-- those services, the average per service, and their top service. A
-- reassigned line counts for the staff member it is assigned to now.
create or replace function private.r_by_staff(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select i.staff_id, i.service_id, i.item_name, i.quantity, i.line_total
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    where s.status = 'paid' and s.business_date between p_from and p_to
      and i.service_id is not null and i.staff_id is not null
  ),
  per_service as (
    select l.staff_id, l.service_id, coalesce(sv.name, max(l.item_name)) as name,
           sum(l.quantity) as times, sum(l.line_total) as revenue
    from lines l
    left join public.services sv on sv.id = l.service_id
    group by l.staff_id, l.service_id, sv.name
  ),
  top as (
    select distinct on (staff_id) staff_id, name, times
    from per_service
    order by staff_id, times desc, revenue desc, name
  ),
  per_staff as (
    select staff_id, sum(quantity) as services, sum(line_total)::bigint as revenue
    from lines
    group by staff_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id', p.staff_id,
           'name', st.name,
           'services', p.services,
           'revenue', p.revenue,
           'average_per_service', round(p.revenue::numeric / p.services)::bigint,
           'top_service', jsonb_build_object('name', t.name, 'times', t.times))
         order by p.revenue desc, st.name), '[]'::jsonb)
  from per_staff p
  join public.staff st on st.id = p.staff_id
  left join top t on t.staff_id = p.staff_id
$$;

-- One row per day in the period (zeros included), for charts.
create or replace function private.r_by_day(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object(
           'date', d.day::date,
           'revenue', coalesce(x.revenue, 0),
           'sales_count', coalesce(x.sales_count, 0),
           'services_count', coalesce(y.services_count, 0))
         order by d.day)
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d(day)
  left join (
    select business_date, sum(total)::bigint as revenue, count(*) as sales_count
    from public.sales
    where status = 'paid' and business_date between p_from and p_to
    group by business_date
  ) x on x.business_date = d.day::date
  left join (
    select s.business_date, sum(i.quantity) as services_count
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    where s.status = 'paid' and s.business_date between p_from and p_to and i.service_id is not null
    group by s.business_date
  ) y on y.business_date = d.day::date
$$;

-- Monday (1) to Sunday (7), with how many of each weekday the period has, so
-- the busiest days can be compared fairly.
create or replace function private.r_by_weekday(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object(
           'weekday', w.weekday,
           'name', w.name,
           'days', (select count(*) from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g(day)
                    where extract(isodow from g.day) = w.weekday),
           'revenue', coalesce(x.revenue, 0),
           'sales_count', coalesce(x.sales_count, 0),
           'services_count', coalesce(y.services_count, 0))
         order by w.weekday)
  from (values (1, 'Monday'), (2, 'Tuesday'), (3, 'Wednesday'), (4, 'Thursday'), (5, 'Friday'), (6, 'Saturday'), (7, 'Sunday'))
         as w(weekday, name)
  left join (
    select extract(isodow from business_date)::integer as weekday, sum(total)::bigint as revenue, count(*) as sales_count
    from public.sales
    where status = 'paid' and business_date between p_from and p_to
    group by 1
  ) x on x.weekday = w.weekday
  left join (
    select extract(isodow from s.business_date)::integer as weekday, sum(i.quantity) as services_count
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
    where s.status = 'paid' and s.business_date between p_from and p_to and i.service_id is not null
    group by 1
  ) y on y.weekday = w.weekday
$$;

-- Identified customers in the period who also had a paid sale before it,
-- divided by identified customers in the period.
create or replace function private.r_repeat_customers(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with period as (
    select distinct customer_id from public.sales
    where status = 'paid' and business_date between p_from and p_to and customer_id is not null
  ),
  counts as (
    select count(*) as identified,
           count(*) filter (where exists (
             select 1 from public.sales s
             where s.customer_id = period.customer_id and s.status = 'paid' and s.business_date < p_from)) as repeat
    from period
  )
  select jsonb_build_object(
    'identified', identified,
    'repeat', repeat,
    'rate', case when identified > 0 then round(repeat::numeric / identified, 4) end
  )
  from counts
$$;

-- Voided sales sold in the period, and sales voided during the period (an
-- older sale voided now is listed too, flagged).
create or replace function private.r_voids(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', s.id,
           'receipt_no', s.receipt_no,
           'paid_at', s.paid_at,
           'business_date', s.business_date,
           'total', s.total,
           'voided_at', s.voided_at,
           'voided_by', p.display_name,
           'void_reason', s.void_reason,
           'sold_in_period', s.business_date between p_from and p_to)
         order by s.voided_at, s.receipt_no), '[]'::jsonb)
  from public.sales s
  left join public.profiles p on p.id = s.voided_by
  where s.status = 'voided'
    and (s.business_date between p_from and p_to
         or (s.voided_at >= private.accra_day_start(p_from) and s.voided_at < private.accra_day_start(p_to + 1)))
$$;

-- Past sales: those that happened in the period, and those entered during it.
create or replace function private.r_backdated(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', s.id,
           'receipt_no', s.receipt_no,
           'paid_at', s.paid_at,
           'recorded_at', s.recorded_at,
           'business_date', s.business_date,
           'total', s.total,
           'status', s.status,
           'recorded_by', p.display_name,
           'sold_in_period', s.business_date between p_from and p_to)
         order by s.recorded_at, s.receipt_no), '[]'::jsonb)
  from public.sales s
  left join public.profiles p on p.id = s.created_by
  where s.is_backdated
    and (s.business_date between p_from and p_to
         or (s.recorded_at >= private.accra_day_start(p_from) and s.recorded_at < private.accra_day_start(p_to + 1)))
$$;

-- Sales entered after their day was closed.
create or replace function private.r_after_close(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', s.id,
           'receipt_no', s.receipt_no,
           'paid_at', s.paid_at,
           'recorded_at', s.recorded_at,
           'business_date', s.business_date,
           'total', s.total,
           'status', s.status,
           'recorded_by', p.display_name)
         order by s.recorded_at, s.receipt_no), '[]'::jsonb)
  from public.sales s
  left join public.profiles p on p.id = s.created_by
  where s.after_close and s.business_date between p_from and p_to
$$;

-- Every void request created in the period.
create or replace function private.r_void_requests(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', vr.id,
           'sale_id', vr.sale_id,
           'receipt_no', s.receipt_no,
           'status', vr.status,
           'requested_by', rq.display_name,
           'requested_at', vr.created_at,
           'reason', vr.reason,
           'decided_by', dc.display_name,
           'decided_at', vr.decided_at,
           'decision_note', vr.decision_note)
         order by vr.created_at), '[]'::jsonb)
  from public.void_requests vr
  join public.sales s on s.id = vr.sale_id
  left join public.profiles rq on rq.id = vr.requested_by
  left join public.profiles dc on dc.id = vr.decided_by
  where vr.created_at >= private.accra_day_start(p_from) and vr.created_at < private.accra_day_start(p_to + 1)
$$;

-- Per POS account: sales recorded (paid ones in the period), their revenue,
-- price overrides on those sales, and void requests made. Every counter
-- account is listed (with zeros); the owner appears when they rang sales.
create or replace function private.r_by_counter_user(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with period_sales as (
    select s.id, s.created_by, s.total from public.sales s
    where s.status = 'paid' and s.business_date between p_from and p_to
  ),
  per_user as (
    select created_by as user_id, count(*) as sales_count, sum(total)::bigint as revenue
    from period_sales group by created_by
  ),
  overrides as (
    select s.created_by as user_id, count(*) as overrides
    from public.sale_items i join period_sales s on s.id = i.sale_id
    where i.unit_price <> i.list_price
    group by s.created_by
  ),
  requests as (
    select requested_by as user_id, count(*) as void_requests
    from public.void_requests
    where created_at >= private.accra_day_start(p_from) and created_at < private.accra_day_start(p_to + 1)
    group by requested_by
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', p.id,
           'name', p.display_name,
           'role', p.role,
           'active', p.active,
           'sales_count', coalesce(u.sales_count, 0),
           'revenue', coalesce(u.revenue, 0),
           'overrides', coalesce(o.overrides, 0),
           'void_requests', coalesce(r.void_requests, 0))
         order by p.role desc, coalesce(u.revenue, 0) desc, p.display_name), '[]'::jsonb)
  from public.profiles p
  left join per_user u on u.user_id = p.id
  left join overrides o on o.user_id = p.id
  left join requests r on r.user_id = p.id
  where p.role = 'counter' or u.user_id is not null or r.user_id is not null
$$;

-- The day closes of the period (reopened ones included, marked).
create or replace function private.r_day_close(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', dc.id,
           'business_date', dc.business_date,
           'opening_float', dc.opening_float,
           'opening_float_reason', dc.opening_float_reason,
           'expected_cash', dc.expected_cash,
           'counted_cash', dc.counted_cash,
           'cash_difference', dc.cash_difference,
           'momo_reported', dc.momo_reported,
           'expected_momo', dc.expected_momo,
           'expected_card', dc.expected_card,
           'expected_other', dc.expected_other,
           'sales_count', dc.sales_count,
           'note', dc.note,
           'closed_by', cb.display_name,
           'closed_at', dc.closed_at,
           'active', dc.reopened_at is null,
           'reopened_by', rb.display_name,
           'reopened_at', dc.reopened_at,
           'reopen_reason', dc.reopen_reason)
         order by dc.business_date, dc.closed_at), '[]'::jsonb)
  from public.day_closes dc
  left join public.profiles cb on cb.id = dc.closed_by
  left join public.profiles rb on rb.id = dc.reopened_by
  where dc.business_date between p_from and p_to
$$;

-- audit_log rows written in the period, newest first (at most p_limit).
create or replace function private.r_changes(p_from date, p_to date, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with rows as (
    select * from public.audit_log a
    where a.created_at >= private.accra_day_start(p_from) and a.created_at < private.accra_day_start(p_to + 1)
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

-- Every sale of one business day (paid and voided), for the day report.
create or replace function private.r_day_sales(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', s.id,
           'receipt_no', s.receipt_no,
           'paid_at', s.paid_at,
           'status', s.status,
           'total', s.total,
           'channel', s.channel,
           'customer_name', s.customer_name,
           'customer_phone', s.customer_phone,
           'is_backdated', s.is_backdated,
           'after_close', s.after_close,
           'recorded_by', p.display_name,
           'items', coalesce((
             select jsonb_agg(jsonb_build_object('name', i.item_name, 'quantity', i.quantity, 'line_total', i.line_total,
                                                 'staff_name', st.name)
                              order by i.line_no)
             from public.sale_items i left join public.staff st on st.id = i.staff_id
             where i.sale_id = s.id), '[]'::jsonb),
           'payments', coalesce((
             select jsonb_agg(jsonb_build_object('method', sp.method, 'kind', sp.kind, 'amount', sp.amount)
                              order by sp.created_at, sp.id)
             from public.sale_payments sp where sp.sale_id = s.id), '[]'::jsonb))
         order by s.paid_at, s.receipt_no), '[]'::jsonb)
  from public.sales s
  left join public.profiles p on p.id = s.created_by
  where s.business_date = p_date
$$;

-- The day report: everything the Close day download and the PC backup save.
create or replace function private.r_day_close_export(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_date', p_date,
    'studio_name', (select studio_name from public.studio_settings limit 1),
    'generated_at', now(),
    'figures', private.r_figures(p_date, p_date),
    'by_payment_method', private.r_by_payment_method(p_date, p_date),
    'by_staff', private.r_by_staff(p_date, p_date),
    'by_service', private.r_by_service(p_date, p_date),
    'by_channel', private.r_by_channel(p_date, p_date),
    'sales', private.r_day_sales(p_date),
    'voids', private.r_voids(p_date, p_date),
    'backdated', private.r_backdated(p_date, p_date),
    'after_close', private.r_after_close(p_date, p_date),
    'void_requests', private.r_void_requests(p_date, p_date),
    'day_closes', private.r_day_close(p_date, p_date)
  )
$$;

-- -----------------------------------------------------------------------------
-- Public report functions (owner only)
-- -----------------------------------------------------------------------------

create or replace function public.report_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_summary(p_from, p_to); end; $$;

create or replace function public.report_by_payment_method(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_payment_method(p_from, p_to); end; $$;

create or replace function public.report_by_service(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_service(p_from, p_to); end; $$;

create or replace function public.report_by_category(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_category(p_from, p_to); end; $$;

create or replace function public.report_by_channel(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_channel(p_from, p_to); end; $$;

create or replace function public.report_by_staff(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_staff(p_from, p_to); end; $$;

create or replace function public.report_by_day(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_day(p_from, p_to); end; $$;

create or replace function public.report_by_weekday(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_weekday(p_from, p_to); end; $$;

create or replace function public.report_repeat_customers(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_repeat_customers(p_from, p_to); end; $$;

create or replace function public.report_voids(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_voids(p_from, p_to); end; $$;

create or replace function public.report_backdated(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_backdated(p_from, p_to); end; $$;

create or replace function public.report_after_close(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_after_close(p_from, p_to); end; $$;

create or replace function public.report_void_requests(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_void_requests(p_from, p_to); end; $$;

create or replace function public.report_by_counter_user(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_by_counter_user(p_from, p_to); end; $$;

create or replace function public.report_day_close(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_day_close(p_from, p_to); end; $$;

create or replace function public.report_changes(p_from date, p_to date, p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin perform private.report_guard(p_from, p_to); return private.r_changes(p_from, p_to, p_limit); end; $$;

-- The owner: any day. A counter user: only a day with an active close (after
-- the blind count), so nothing is visible before the cash is counted.
create or replace function public.report_day_close_export(p_business_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select user_role into v_role from private.require_pos_user(array['owner', 'counter']);
  if p_business_date is null then
    raise exception 'invalid_input' using detail = 'Choose a day.';
  end if;
  if v_role = 'counter' and not private.is_day_closed(p_business_date) then
    raise exception 'not_closed' using detail = 'The day report is available after the day is closed.';
  end if;
  return private.r_day_close_export(p_business_date);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: the builders are never callable directly; the public functions are
-- for signed-in users and check the role themselves.
-- -----------------------------------------------------------------------------
revoke execute on function
  private.accra_day_start(date),
  private.report_guard(date, date),
  private.r_figures(date, date),
  private.r_summary(date, date),
  private.r_by_payment_method(date, date),
  private.r_by_service(date, date),
  private.r_by_category(date, date),
  private.r_by_channel(date, date),
  private.r_by_staff(date, date),
  private.r_by_day(date, date),
  private.r_by_weekday(date, date),
  private.r_repeat_customers(date, date),
  private.r_voids(date, date),
  private.r_backdated(date, date),
  private.r_after_close(date, date),
  private.r_void_requests(date, date),
  private.r_by_counter_user(date, date),
  private.r_day_close(date, date),
  private.r_changes(date, date, integer),
  private.r_day_sales(date),
  private.r_day_close_export(date)
from public, anon, authenticated;

revoke execute on function
  public.report_summary(date, date),
  public.report_by_payment_method(date, date),
  public.report_by_service(date, date),
  public.report_by_category(date, date),
  public.report_by_channel(date, date),
  public.report_by_staff(date, date),
  public.report_by_day(date, date),
  public.report_by_weekday(date, date),
  public.report_repeat_customers(date, date),
  public.report_voids(date, date),
  public.report_backdated(date, date),
  public.report_after_close(date, date),
  public.report_void_requests(date, date),
  public.report_by_counter_user(date, date),
  public.report_day_close(date, date),
  public.report_changes(date, date, integer),
  public.report_day_close_export(date)
from public, anon;

grant execute on function
  public.report_summary(date, date),
  public.report_by_payment_method(date, date),
  public.report_by_service(date, date),
  public.report_by_category(date, date),
  public.report_by_channel(date, date),
  public.report_by_staff(date, date),
  public.report_by_day(date, date),
  public.report_by_weekday(date, date),
  public.report_repeat_customers(date, date),
  public.report_voids(date, date),
  public.report_backdated(date, date),
  public.report_after_close(date, date),
  public.report_void_requests(date, date),
  public.report_by_counter_user(date, date),
  public.report_day_close(date, date),
  public.report_changes(date, date, integer),
  public.report_day_close_export(date)
to authenticated;
