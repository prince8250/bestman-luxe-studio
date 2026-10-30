// Builds the logo files the app uses from the studio's original JPG.
//
// The original (context/studio-assets/logo/bestman-logo.jpg) is a white circle
// on a blurry dark background. There is no transparent version, so this script
// finds the white circle and cuts it out with a soft-edged circular mask.
//
// Run: node tools/assets/make-logo.mjs
// Outputs:
//   public/brand/logo-crest.png    transparent crest for dark backgrounds (site hero, POS sidebar)
//   public/brand/logo-receipt.png  black and white on white, for 80mm receipts
//   app/icon.png, app/apple-icon.png  favicon and home-screen icon

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "context/studio-assets/logo/bestman-logo.jpg");

const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

// The circle is the only large near-white area. Its bounding box gives the
// centre and radius. Scan the middle rows and columns so stray highlights in
// the silver lettering cannot stretch the box.
const isWhite = (x, y) => {
  const i = (y * width + x) * 3;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 14;
};

function extent(fixed, length, horizontal) {
  let first = -1, last = -1;
  for (let t = 0; t < length; t++) {
    const white = horizontal ? isWhite(t, fixed) : isWhite(fixed, t);
    if (white) {
      if (first < 0) first = t;
      last = t;
    }
  }
  return [first, last];
}

// Sample several rows/columns near the middle and keep the widest span.
let left = width, right = 0, top = height, bottom = 0;
for (let offset = -40; offset <= 40; offset += 4) {
  const [l, r] = extent(Math.round(height / 2) + offset, width, true);
  const [t, b] = extent(Math.round(width / 2) + offset, height, false);
  if (l >= 0) { left = Math.min(left, l); right = Math.max(right, r); }
  if (t >= 0) { top = Math.min(top, t); bottom = Math.max(bottom, b); }
}

const cx = (left + right) / 2;
const cy = (top + bottom) / 2;
// Inset by 2px so no dark background fringe survives at the edge.
const radius = Math.min(right - left, bottom - top) / 2 - 2;
console.log(`circle centre (${cx.toFixed(1)}, ${cy.toFixed(1)}), radius ${radius.toFixed(1)} in ${width}x${height}`);

const size = Math.ceil(radius * 2);
const cropLeft = Math.round(cx - radius);
const cropTop = Math.round(cy - radius);

// Copy the square around the circle into an RGBA buffer, with a soft-edged
// circular alpha (1.5px feather) so the edge is smooth at any size.
const rgba = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const sx = Math.min(width - 1, Math.max(0, cropLeft + x));
    const sy = Math.min(height - 1, Math.max(0, cropTop + y));
    const si = (sy * width + sx) * 3;
    const di = (y * size + x) * 4;
    const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
    const alpha = Math.max(0, Math.min(1, (size / 2 - d) / 1.5));
    rgba[di] = data[si];
    rgba[di + 1] = data[si + 1];
    rgba[di + 2] = data[si + 2];
    rgba[di + 3] = Math.round(alpha * 255);
  }
}

const crest = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();

await sharp(crest).resize(640, 640).png({ compressionLevel: 9 }).toFile(path.join(root, "public/brand/logo-crest.png"));
await sharp(crest).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(root, "app/icon.png"));
// Apple home-screen icons cannot be transparent: put the crest on black.
await sharp(crest)
  .resize(160, 160)
  .flatten({ background: "#000000" })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: "#000000" })
  .png()
  .toFile(path.join(root, "app/apple-icon.png"));

// Receipt version: grayscale on white with a little extra contrast so the
// silver lettering survives a thermal printer.
await sharp(crest)
  .flatten({ background: "#ffffff" })
  .grayscale()
  .linear(1.35, -60)
  .resize(384, 384)
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, "public/brand/logo-receipt.png"));

console.log("wrote public/brand/logo-crest.png, public/brand/logo-receipt.png, app/icon.png, app/apple-icon.png");
