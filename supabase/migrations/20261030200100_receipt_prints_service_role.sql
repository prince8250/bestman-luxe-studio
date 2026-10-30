-- receipt_prints was created after the blanket service_role grant in
-- 20261030120500_security.sql. Server-only code (backups, spec 20) reads it.
grant select on public.receipt_prints to service_role;
