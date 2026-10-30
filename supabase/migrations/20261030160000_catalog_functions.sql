-- =============================================================================
-- Catalog functions (spec 06). Each is one transaction and owner-only.
-- Price changes are written to audit_log by the services_audit trigger, so
-- every path that changes a price (one service or many) is logged the same way.
-- =============================================================================

-- save_service(payload): insert or update a service and replace its staff
-- assignments together.
-- payload: { "id"?: uuid, "category_id": uuid, "name": text, "description": text,
--            "image_path": text, "price": int (pesewas), "duration_minutes": int,
--            "show_on_website": bool, "bookable_online": bool, "sort_order": int,
--            "staff_ids": [uuid, ...] }
create or replace function public.save_service(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_staff_ids uuid[];
begin
  perform private.require_pos_user(array['owner']);

  begin
    v_id := nullif(payload ->> 'id', '')::uuid;
    select coalesce(array_agg(value::uuid), '{}') into v_staff_ids
      from jsonb_array_elements_text(coalesce(payload -> 'staff_ids', '[]'::jsonb));
  exception when invalid_text_representation then
    raise exception 'invalid_input' using detail = 'An id in the service is not valid.';
  end;

  if exists (select 1 from unnest(v_staff_ids) as s(id)
             where not exists (select 1 from public.staff st where st.id = s.id and st.active)) then
    raise exception 'staff_unavailable' using detail = 'Only active staff can be assigned to a service.';
  end if;
  if not exists (select 1 from public.service_categories c where c.id = (payload ->> 'category_id')::uuid) then
    raise exception 'invalid_input' using detail = 'Choose a category.';
  end if;

  if v_id is null then
    insert into public.services (category_id, name, description, image_path, price, duration_minutes,
                                 show_on_website, bookable_online, sort_order)
    values ((payload ->> 'category_id')::uuid, payload ->> 'name', nullif(payload ->> 'description', ''),
            nullif(payload ->> 'image_path', ''), (payload ->> 'price')::integer, (payload ->> 'duration_minutes')::integer,
            coalesce((payload ->> 'show_on_website')::boolean, true), coalesce((payload ->> 'bookable_online')::boolean, true),
            coalesce((payload ->> 'sort_order')::integer, 0))
    returning id into v_id;
  else
    update public.services set
      category_id = (payload ->> 'category_id')::uuid,
      name = payload ->> 'name',
      description = nullif(payload ->> 'description', ''),
      image_path = nullif(payload ->> 'image_path', ''),
      price = (payload ->> 'price')::integer,
      duration_minutes = (payload ->> 'duration_minutes')::integer,
      show_on_website = coalesce((payload ->> 'show_on_website')::boolean, true),
      bookable_online = coalesce((payload ->> 'bookable_online')::boolean, true),
      sort_order = coalesce((payload ->> 'sort_order')::integer, 0)
    where id = v_id;
    if not found then
      raise exception 'not_found' using detail = 'That service was not found.';
    end if;
  end if;

  delete from public.service_staff where service_id = v_id and staff_id <> all (v_staff_ids);
  insert into public.service_staff (service_id, staff_id)
    select v_id, s.id from unnest(v_staff_ids) as s(id)
  on conflict do nothing;

  return v_id;
end;
$$;

-- update_service_prices(changes): many prices in one save, all or nothing.
-- changes: [{ "id": uuid, "price": int (pesewas) }, ...]
create or replace function public.update_service_prices(changes jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change jsonb;
  v_count integer := 0;
begin
  perform private.require_pos_user(array['owner']);
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) = 0 then
    raise exception 'invalid_input' using detail = 'There are no price changes to save.';
  end if;
  for v_change in select value from jsonb_array_elements(changes) loop
    if (v_change ->> 'price')::integer < 0 then
      raise exception 'invalid_price' using detail = 'A price cannot be negative.';
    end if;
    update public.services set price = (v_change ->> 'price')::integer
      where id = (v_change ->> 'id')::uuid and price <> (v_change ->> 'price')::integer;
    v_count := v_count + case when found then 1 else 0 end;
  end loop;
  return v_count;
end;
$$;

-- reorder_rows(table, ids): sets sort_order 10, 20, 30, ... in the given order.
-- Only for the owner-managed lists named below.
create or replace function public.reorder_rows(p_table text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_pos_user(array['owner']);
  if p_table not in ('service_categories', 'services', 'staff', 'gallery_images', 'offers') then
    raise exception 'invalid_input' using detail = 'This list cannot be reordered.';
  end if;
  execute format(
    'update public.%I as t set sort_order = o.position * 10
       from unnest($1) with ordinality as o(id, position)
      where t.id = o.id',
    p_table)
  using p_ids;
end;
$$;

revoke execute on function public.save_service(jsonb), public.update_service_prices(jsonb), public.reorder_rows(text, uuid[])
  from public, anon;
grant execute on function public.save_service(jsonb), public.update_service_prices(jsonb), public.reorder_rows(text, uuid[])
  to authenticated;
