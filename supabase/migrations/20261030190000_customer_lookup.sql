-- =============================================================================
-- customer_lookup(phone) for the New sale screen (spec 08).
--
-- Counter users only read today's sales (RLS), so they cannot count a
-- returning customer's visits themselves. This function returns the visit
-- count and last visit for one phone number, and never any money figure, so
-- it is safe for both POS roles. Visits count paid, non-voided sales only.
-- =============================================================================

create or replace function public.customer_lookup(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  perform private.require_pos_user(array['owner', 'counter']);
  if p_phone is null or not private.is_e164(p_phone) then
    raise exception 'invalid_phone' using detail = 'The phone number is not valid.';
  end if;

  select * into v_customer from public.customers where phone = p_phone;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'id', v_customer.id,
    'full_name', v_customer.full_name,
    'blocked', v_customer.blocked,
    'blocked_reason', v_customer.blocked_reason,
    'visits', (select count(*) from public.sales s where s.customer_id = v_customer.id and s.status = 'paid'),
    'last_visit', (select max(s.paid_at) from public.sales s where s.customer_id = v_customer.id and s.status = 'paid')
  );
end;
$$;

revoke execute on function public.customer_lookup(text) from public, anon;
grant execute on function public.customer_lookup(text) to authenticated;
