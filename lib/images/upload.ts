import { compressImage } from "@/lib/images/compress";
import type { ImageBucket } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Resizes an image in the browser and uploads it to a public bucket with the
// signed-in owner's session (storage policies allow owners only). Returns the
// path to save in the database. Used by the staff, catalog, gallery, and
// offers forms.
export async function uploadImage(
  bucket: ImageBucket,
  file: File,
  { folder, maxEdge }: { folder: string; maxEdge: number },
): Promise<string> {
  const image = await compressImage(file, { maxEdge, quality: 0.8 });
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${image.extension}`;
  const { error } = await createSupabaseBrowserClient().storage.from(bucket).upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000",
  });
  if (error) throw new Error("The photo could not be uploaded. Check the internet connection.");
  return path;
}

// Removes an uploaded file that was not saved after all (for example the save failed).
export async function discardUpload(bucket: ImageBucket, path: string): Promise<void> {
  await createSupabaseBrowserClient().storage.from(bucket).remove([path]);
}
