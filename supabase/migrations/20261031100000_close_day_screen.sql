-- =============================================================================
-- Close day screen (spec 17). close_day and reopen_day exist since spec 02;
-- the screen needs two small reads that a counter user cannot do through RLS
-- (they see today's sales and today's close only):
--
-- 1. unclosed_days(): earlier days (up to 14 back) that have sales and no
--    active close, so the counter can close a day that was missed. Dates and
--    sale counts only: never money, so the count stays blind.
-- 2. day_status(): today's status for the sidebar card: open since the first
--    sign-in or sale of the day, or closed at what time and by whom.
-- Each is a private builder that takes the date (so the tests can use fixed
-- days) and a public wrapper for POS users.
-- =============================================================================

create or replace function private.unclosed_days(p_today date, p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('business_date', d.business_date, 'sales_count', d.sales_count)
                            order by d.business_date desc), '[]'::jsonb)
  from (
    select s.business_date, count(*) filter (where s.status = 'paid') as sales_count
    from public.sales s
    where s.business_date >= p_today - p_days and s.business_date < p_today
    group by s.business_date
  ) d
  where d.sales_count > 0 and not private.is_day_closed(d.business_date)
$$;

create or replace function private.day_status(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_date', p_date,
    -- The first sign-in or sale of the day, whichever came first.
    'open_since', (
      select min(t) from (
        select min(e.signed_in_at) as t from public.sign_in_events e
        where e.signed_in_at >= private.accra_day_start(p_date) and e.signed_in_at < private.accra_day_start(p_date + 1)
        union all
        select min(s.paid_at) from public.sales s where s.business_date = p_date
      ) firsts),
    'closed_at', c.closed_at,
    'closed_by', p.display_name)
  from (select 1) one
  left join public.day_closes c on c.business_date = p_date and c.reopened_at is null
  left join public.profiles p on p.id = c.closed_by
$$;

create or replace function public.unclosed_days()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_pos_user(array['owner', 'counter']);
  return private.unclosed_days(private.accra_today(), 14);
end;
$$;

create or replace function public.day_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_pos_user(array['owner', 'counter']);
  return private.day_status(private.accra_today());
end;
$$;

revoke execute on function private.unclosed_days(date, integer) from public, anon, authenticated;
revoke execute on function private.day_status(date) from public, anon, authenticated;
revoke execute on function public.unclosed_days() from public, anon;
revoke execute on function public.day_status() from public, anon;
grant execute on function public.unclosed_days() to authenticated;
grant execute on function public.day_status() to authenticated;
