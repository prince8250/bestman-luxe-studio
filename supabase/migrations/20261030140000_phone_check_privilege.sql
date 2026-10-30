-- =============================================================================
-- Fix: the phone check constraints on staff, customers, studio_settings,
-- sales, and appointments call private.is_e164(). Postgres checks EXECUTE
-- permission on functions in a check constraint for the user doing the write,
-- so the owner's own session could not insert or update staff or settings.
-- is_e164 only tests a text pattern, so any role may run it.
-- =============================================================================

grant execute on function private.is_e164(text) to authenticated, service_role;
