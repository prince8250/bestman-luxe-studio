-- =============================================================================
-- Fixed-window rate-limit counters in public.rate_limits (spec 03: slowing
-- down repeated failed sign-ins; spec 34: booking abuse protection).
--
-- A window starts at a multiple of p_window_seconds since the epoch (for
-- 3600 seconds: on the hour), so a key's count resets when the next window
-- begins. Keys are hashed by the caller (no raw emails, phones, or IPs).
-- Service role only: called from server-only code.
-- =============================================================================

create or replace function private.rate_limit_window(p_window_seconds integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
$$;

-- Adds one to the key's count in the current window and returns the new count.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := private.rate_limit_window(p_window_seconds);
  v_count integer;
begin
  if p_key is null or length(p_key) not between 1 and 200 or p_window_seconds not between 60 and 86400 then
    raise exception 'invalid_input' using detail = 'A rate-limit key and a window of 60 to 86400 seconds are required.';
  end if;
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Housekeeping: old windows are never needed again.
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_count;
end;
$$;

-- The key's count in the current window (0 when there is none).
create or replace function public.rate_limit_count(p_key text, p_window_seconds integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.count from public.rate_limits r
     where r.key = p_key and r.window_start = private.rate_limit_window(p_window_seconds)),
    0)
$$;

-- Forgets a key (for example after a successful sign-in).
create or replace function public.rate_limit_clear(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where key = p_key
$$;

revoke execute on function
  private.rate_limit_window(integer),
  public.rate_limit_hit(text, integer),
  public.rate_limit_count(text, integer),
  public.rate_limit_clear(text)
from public, anon, authenticated;

grant execute on function
  public.rate_limit_hit(text, integer),
  public.rate_limit_count(text, integer),
  public.rate_limit_clear(text)
to service_role;
