// Browser-side image resizing before upload. Phone photos are often 3–5 MB;
// most website visitors are on mobile data, so every image is shrunk and
// re-encoded before it leaves the PC or phone (code-standards.md, "Images").

export interface CompressOptions {
  /** Longest edge in pixels after resizing. */
  maxEdge: number;
  /** 0–1 encoder quality. */
  quality?: number;
}

export interface CompressedImage {
  blob: Blob;
  extension: "webp" | "jpg";
  width: number;
  height: number;
}

// Scales (width, height) down so the longest edge is at most maxEdge.
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressImage(file: File, { maxEdge, quality = 0.8 }: CompressOptions): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPEG, PNG, or WebP).");

  // imageOrientation: respect the camera's rotation so phone photos are upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize images.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  // WebP is smaller; fall back to JPEG on browsers that cannot encode it.
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, extension: "webp", ...size };
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("The image could not be compressed.");
  return { blob: jpeg, extension: "jpg", ...size };
}
