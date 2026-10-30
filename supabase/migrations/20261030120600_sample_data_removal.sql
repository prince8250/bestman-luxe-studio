-- =============================================================================
-- Removing sample data in one step.
--
-- seed.sql fills the development database with clearly labeled sample data
-- (staff, prices, customers, two weeks of sales, appointments) and records
-- every row it creates in private.sample_rows. Before the studio starts using
-- the system for real, the owner removes it all with:
--
--   select public.remove_sample_data();          -- keeps the service list
--   select public.remove_sample_data(false);     -- also removes the services
--
-- (also reachable from POS Settings once spec 07 is built).
--
-- This is the ONLY code path that deletes sales. It removes only rows listed
-- in private.sample_rows. Real rows are never touched; a sample staff member
-- or service that a real sale refers to is archived instead of deleted.
-- =============================================================================

create or replace function public.remove_sample_data(p_keep_catalog boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_sales uuid[];
  v_items uuid[];
  v_appointments uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- Owner only (or the database owner running it from the SQL editor / CLI).
  if (select auth.uid()) is not null then
    select user_role into v_actor_role from private.require_pos_user(array['owner']);
  end if;

  select coalesce(array_agg(row_id), '{}') into v_sales from private.sample_rows where table_name = 'sales';
  select coalesce(array_agg(id), '{}') into v_items from public.sale_items where sale_id = any (v_sales);
  select coalesce(array_agg(row_id), '{}') into v_appointments from private.sample_rows where table_name = 'appointments';

  -- Lift the "never delete" guards for this transaction only.
  alter table public.sales disable trigger sales_no_delete;
  alter table public.sale_items disable trigger sale_items_no_delete;
  alter table public.sale_payments disable trigger sale_payments_no_delete;
  alter table public.day_closes disable trigger day_closes_no_delete;
  alter table public.audit_log disable trigger audit_log_no_update_or_delete;

  -- History and alerts about sample rows.
  delete from public.audit_log
    where entity_id = any (v_sales) or entity_id = any (v_items) or entity_id = any (v_appointments)
       or entity_id in (select row_id from private.sample_rows);
  delete from public.owner_alerts where sale_id = any (v_sales);
  delete from public.owner_alerts where id in (select row_id from private.sample_rows where table_name = 'owner_alerts');
  delete from public.void_requests where sale_id = any (v_sales);

  -- Appointments and sales point at each other: unlink first.
  update public.appointments set sale_id = null, status = 'cancelled', cancel_reason = 'Sample data removed'
    where id = any (v_appointments) and sale_id is not null;
  update public.sales set appointment_id = null where id = any (v_sales);
  -- Run the deferred balance checks queued by that update now: a table with
  -- pending trigger events cannot have its triggers switched back on below.
  set constraints all immediate;

  delete from public.sale_payments where sale_id = any (v_sales);
  delete from public.sale_items where sale_id = any (v_sales);
  delete from public.sales where id = any (v_sales);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('sales', v_n);

  delete from public.appointments where id = any (v_appointments);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('appointments', v_n);

  delete from public.day_closes where id in (select row_id from private.sample_rows where table_name = 'day_closes');

  -- Sample customers, unless a real sale or appointment now uses them.
  delete from public.customers c
    where c.id in (select row_id from private.sample_rows where table_name = 'customers')
      and not exists (select 1 from public.sales s where s.customer_id = c.id)
      and not exists (select 1 from public.appointments a where a.customer_id = c.id);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('customers', v_n);

  delete from public.offers where id in (select row_id from private.sample_rows where table_name = 'offers');
  delete from public.gallery_images where id in (select row_id from private.sample_rows where table_name = 'gallery_images');

  -- Sample staff: deleted, or archived if real history refers to them.
  delete from public.staff_hours where staff_id in (select row_id from private.sample_rows where table_name = 'staff');
  delete from public.staff_time_off where staff_id in (select row_id from private.sample_rows where table_name = 'staff');
  delete from public.service_staff where staff_id in (select row_id from private.sample_rows where table_name = 'staff');
  update public.staff st set active = false, archived_at = now()
    where st.id in (select row_id from private.sample_rows where table_name = 'staff')
      and (exists (select 1 from public.sale_items i where i.staff_id = st.id)
           or exists (select 1 from public.appointments a where a.staff_id = st.id));
  delete from public.staff st
    where st.id in (select row_id from private.sample_rows where table_name = 'staff')
      and not exists (select 1 from public.sale_items i where i.staff_id = st.id)
      and not exists (select 1 from public.appointments a where a.staff_id = st.id);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('staff', v_n);

  if not p_keep_catalog then
    update public.services sv set active = false, archived_at = now()
      where sv.id in (select row_id from private.sample_rows where table_name = 'services')
        and (exists (select 1 from public.sale_items i where i.service_id = sv.id)
             or exists (select 1 from public.appointments a where a.service_id = sv.id));
    delete from public.services sv
      where sv.id in (select row_id from private.sample_rows where table_name = 'services')
        and not exists (select 1 from public.sale_items i where i.service_id = sv.id)
        and not exists (select 1 from public.appointments a where a.service_id = sv.id);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('services', v_n);
    delete from public.service_categories cat
      where cat.id in (select row_id from private.sample_rows where table_name = 'service_categories')
        and not exists (select 1 from public.services sv where sv.category_id = cat.id);
    delete from private.sample_rows where table_name in ('services', 'service_categories');
  end if;

  alter table public.sales enable trigger sales_no_delete;
  alter table public.sale_items enable trigger sale_items_no_delete;
  alter table public.sale_payments enable trigger sale_payments_no_delete;
  alter table public.day_closes enable trigger day_closes_no_delete;
  alter table public.audit_log enable trigger audit_log_no_update_or_delete;
  set constraints all deferred;

  delete from private.sample_rows where table_name not in ('services', 'service_categories');

  -- Real receipts start at BLS-000001 when no sales are left.
  if not exists (select 1 from public.sales) then
    alter sequence public.receipt_no_seq restart with 1;
  end if;

  perform private.write_audit('system', null, 'sample_data_removed', null, v_counts);
  return v_counts;
end;
$$;

revoke execute on function public.remove_sample_data(boolean) from public, anon, authenticated;
grant execute on function public.remove_sample_data(boolean) to authenticated;
