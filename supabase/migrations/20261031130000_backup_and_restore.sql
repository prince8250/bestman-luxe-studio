-- =============================================================================
-- Backups (spec 20, backup-and-recovery.md).
--
-- 1. backup_day_report(date): the end-of-day report for the PC backup script,
--    which calls with a bearer token through the service role (no POS user,
--    so report_day_close_export cannot be used). Service role only.
-- 2. Restoring a JSON snapshot into an EMPTY test project (tools/restore):
--    restore_begin -> restore_table (per table, in batches) -> restore_finish.
--    Rows go in exactly as exported (ids included, audit_log ids too), with
--    the tables' own triggers paused, because one snapshot table arrives per
--    call: a sale's lines come in a later call than the sale, so the
--    "lines add up" check would refuse the sale on its own.
--    restore_begin refuses any database that already has business data, and
--    restore_table / restore_finish work only between begin and finish, so
--    these can never write into a live database. Service role only.
-- =============================================================================

create or replace function public.backup_day_report(p_business_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_business_date is null or p_business_date > private.accra_today() then
    raise exception 'invalid_date' using detail = 'Choose today or an earlier day.';
  end if;
  return private.r_day_close_export(p_business_date);
end;
$$;

-- The tables a snapshot holds, in dependency order (the export uses the same
-- order). Not rate_limits (temporary), not Supabase's auth or storage tables.
create or replace function private.backup_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'profiles', 'studio_settings', 'sign_in_events', 'staff', 'service_categories', 'services', 'service_staff',
    'staff_hours', 'staff_time_off', 'offers', 'gallery_images', 'customers', 'sales', 'sale_items', 'sale_payments',
    'appointments', 'void_requests', 'day_closes', 'owner_alerts', 'receipt_prints', 'backup_runs', 'audit_log'
  ]
$$;

-- One row while a restore is running.
create table private.restore_state (
  id boolean primary key default true check (id),
  started_at timestamptz not null default now()
);

create or replace function private.restore_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_count bigint;
  v_out jsonb := '{}'::jsonb;
begin
  foreach v_table in array private.backup_tables() loop
    execute format('select count(*) from public.%I', v_table) into v_count;
    v_out := v_out || jsonb_build_object(v_table, v_count);
  end loop;
  return v_out;
end;
$$;

-- Starts a restore. Only into a project with the migrations applied and no
-- business data (the one default settings row is allowed).
create or replace function public.restore_begin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb := private.restore_counts();
  v_busy text[];
begin
  select array_agg(key order by key) into v_busy
  from jsonb_each_text(v_counts)
  where key <> 'studio_settings' and value::bigint > 0;
  if v_busy is not null then
    raise exception 'not_empty' using detail = 'This database already has data in: ' || array_to_string(v_busy, ', ')
      || '. Restore only into a new, empty project.';
  end if;
  insert into private.restore_state default values on conflict (id) do update set started_at = now();
  return v_counts;
end;
$$;

-- Inserts one batch of a table's rows exactly as exported. The single
-- studio_settings row replaces the default one. A sale and its appointment
-- point at each other, and an arrived appointment must have its sale, so
-- sales come in first without their appointment; restore_finish links them.
create or replace function public.restore_table(p_table text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_rows jsonb := p_rows;
begin
  if not exists (select 1 from private.restore_state) then
    raise exception 'not_restoring' using detail = 'Call restore_begin first.';
  end if;
  if p_table is null or not (p_table = any (private.backup_tables())) then
    raise exception 'invalid_input' using detail = 'Not a table in the backup: ' || coalesce(p_table, '(none)');
  end if;
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'invalid_input' using detail = 'The rows must be a JSON array.';
  end if;
  if p_table = 'sales' then
    select coalesce(jsonb_agg(r || '{"appointment_id": null}'::jsonb), '[]'::jsonb) into v_rows from jsonb_array_elements(v_rows) r;
  end if;

  execute format('alter table public.%I disable trigger user', p_table);
  if p_table = 'studio_settings' then
    delete from public.studio_settings;
  end if;
  execute format(
    'insert into public.%1$I overriding system value select * from jsonb_populate_recordset(null::public.%1$I, $1)', p_table)
    using v_rows;
  get diagnostics v_count = row_count;
  execute format('alter table public.%I enable trigger user', p_table);
  return v_count;
end;
$$;

-- Ends a restore: links sales back to their appointments, moves the receipt
-- number and audit id counters past the restored rows, and returns the row
-- counts and the latest day's revenue to compare with the snapshot.
-- p_links: [{"id": sale id, "appointment_id": appointment id}]
create or replace function public.restore_finish(p_links jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_receipt bigint;
  v_last_day date;
begin
  if not exists (select 1 from private.restore_state) then
    raise exception 'not_restoring' using detail = 'Call restore_begin first.';
  end if;

  alter table public.sales disable trigger user;
  update public.sales s set appointment_id = (l ->> 'appointment_id')::uuid
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) l
    where s.id = (l ->> 'id')::uuid;
  alter table public.sales enable trigger user;

  select max((substring(receipt_no from '(\d+)$'))::bigint) into v_max_receipt from public.sales;
  if v_max_receipt is null then
    perform setval('public.receipt_no_seq', 1, false);
  else
    perform setval('public.receipt_no_seq', v_max_receipt, true);
  end if;
  perform setval(pg_get_serial_sequence('public.audit_log', 'id'),
                 coalesce((select max(id) from public.audit_log), 1), (select count(*) from public.audit_log) > 0);

  delete from private.restore_state;

  select max(business_date) into v_last_day from public.sales where status = 'paid';
  return jsonb_build_object(
    'row_counts', private.restore_counts(),
    'last_day', jsonb_build_object(
      'business_date', v_last_day,
      'revenue', coalesce((select sum(total) from public.sales where status = 'paid' and business_date = v_last_day), 0)));
end;
$$;

revoke execute on function public.backup_day_report(date) from public, anon, authenticated;
revoke execute on function private.backup_tables() from public, anon, authenticated;
revoke execute on function private.restore_counts() from public, anon, authenticated;
revoke execute on function public.restore_begin() from public, anon, authenticated;
revoke execute on function public.restore_table(text, jsonb) from public, anon, authenticated;
revoke execute on function public.restore_finish(jsonb) from public, anon, authenticated;
grant execute on function public.backup_day_report(date) to service_role;
grant execute on function public.restore_begin() to service_role;
grant execute on function public.restore_table(text, jsonb) to service_role;
grant execute on function public.restore_finish(jsonb) to service_role;
