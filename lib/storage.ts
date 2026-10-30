import { getPublicEnv } from "@/lib/env";

// Storage buckets (supabase/migrations/..._security.sql). The database stores
// the path inside a bucket, never a full URL, so the URL can be rebuilt if the
// project or domain changes.
export const IMAGE_BUCKETS = ["gallery", "staff", "catalog"] as const;
export type ImageBucket = (typeof IMAGE_BUCKETS)[number];

// The public URL of an image in one of the public buckets.
export function publicImageUrl(bucket: ImageBucket, path: string): string {
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

// A path we created for this bucket: "<folder>/<file>.<webp|jpg|png>", no
// "..", no leading slash. Server actions check paths sent by the browser.
export function isSafeImagePath(path: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/i.test(path);
}
