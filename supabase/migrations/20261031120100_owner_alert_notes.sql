-- finish_owner_alert keeps a note on success too, so an alert handled in
-- SMS_MODE console or sandbox reads "sent" with "Console: logged, not
-- delivered" (or the sandbox note), never as if a real SMS went out.
create or replace function public.finish_owner_alert(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.owner_alerts
    set sms_status = case when p_ok then 'sent' else 'failed' end,
        sms_error = case when p_ok then left(nullif(trim(p_error), ''), 500)
                         else left(coalesce(nullif(trim(p_error), ''), 'Not sent'), 500) end,
        sms_sent_at = case when p_ok then now() end
    where id = p_id and sms_status = 'failed' and sms_error = 'Sending'
$$;

revoke execute on function public.finish_owner_alert(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_owner_alert(uuid, boolean, text) to service_role;
