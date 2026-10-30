-- =============================================================================
-- Receipts (spec 09).
--
-- receipt_data(sale_id) returns everything a receipt shows, read from the
-- stored sale only (never from the screen that made it). It is a security
-- definer function because a counter user cannot read other accounts'
-- profiles, and the receipt names the account that rang the sale ("Served at
-- the counter by ..."). It applies the same rule as the sales table: the
-- owner sees every sale, the counter today's only.
--
-- receipt_prints records every print, so the first print is the original and
-- every later one is marked REPRINT.
-- =============================================================================

create table public.receipt_prints (
  id uuid primary key default gen_random_uuid(),
  -- Cascade only matters to remove_sample_data: real sales are never deleted.
  sale_id uuid not null references public.sales (id) on delete cascade,
  printed_by uuid not null references public.profiles (id) on delete restrict,
  printed_at timestamptz not null default now()
);
comment on table public.receipt_prints is 'One row per printed receipt (all copies of one print). Written only by record_receipt_print.';
create index receipt_prints_sale_idx on public.receipt_prints (sale_id);

alter table public.receipt_prints enable row level security;
grant select on public.receipt_prints to authenticated;
create policy receipt_prints_select on public.receipt_prints for select to authenticated
  using ((select private.is_owner()));

-- The sales visibility rule (see the sales_select policy) for one sale.
create or replace function private.can_see_sale(p_role text, p_sale public.sales)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_role = 'owner'
    or (p_role = 'counter'
        and (p_sale.business_date = private.accra_today()
             or private.accra_date(p_sale.recorded_at) = private.accra_today()));
$$;

create or replace function public.receipt_data(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_sale public.sales;
begin
  select user_role into v_role from private.require_pos_user(array['owner', 'counter']);

  select * into v_sale from public.sales where id = p_sale_id;
  if not found or not private.can_see_sale(v_role, v_sale) then
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

-- Records one print and returns its number (1 = the original).
create or replace function public.record_receipt_print(p_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_role text;
  v_sale public.sales;
  v_count integer;
begin
  select user_id, user_role into v_user, v_role from private.require_pos_user(array['owner', 'counter']);

  select * into v_sale from public.sales where id = p_sale_id;
  if not found or not private.can_see_sale(v_role, v_sale) then
    raise exception 'not_found' using detail = 'That receipt was not found.';
  end if;

  insert into public.receipt_prints (sale_id, printed_by) values (p_sale_id, v_user);
  select count(*) into v_count from public.receipt_prints where sale_id = p_sale_id;
  return v_count;
end;
$$;

revoke execute on function private.can_see_sale(text, public.sales) from public, anon;
revoke execute on function public.receipt_data(uuid) from public, anon;
revoke execute on function public.record_receipt_print(uuid) from public, anon;
grant execute on function public.receipt_data(uuid) to authenticated;
grant execute on function public.record_receipt_print(uuid) to authenticated;
