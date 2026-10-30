-- =============================================================================
-- What sample data is left (spec 07, POS Settings): row counts per table from
-- private.sample_rows, so the owner sees what "Remove sample data" will remove.
-- =============================================================================

create or replace function public.sample_data_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_pos_user(array['owner']);
  return (
    select coalesce(jsonb_object_agg(table_name, total), '{}'::jsonb)
    from (select table_name, count(*) as total from private.sample_rows group by table_name) as counts
  );
end;
$$;

revoke execute on function public.sample_data_summary() from public, anon;
grant execute on function public.sample_data_summary() to authenticated;
