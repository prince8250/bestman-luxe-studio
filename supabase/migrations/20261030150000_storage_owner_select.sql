-- =============================================================================
-- Fix: Supabase Storage only removes (and replaces) files the caller can also
-- SELECT through RLS. Visitors read the public buckets through the public URL
-- (no policy needed), but the owner's session had insert, update, and delete
-- policies without select, so removing an old staff photo matched nothing and
-- left the file behind. Owners may now see the objects in the image buckets.
-- The private backups bucket stays service-role only.
-- =============================================================================

create policy images_owner_select on storage.objects for select to authenticated
  using (bucket_id in ('gallery', 'staff', 'catalog') and private.is_owner());
