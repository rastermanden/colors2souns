#!/usr/bin/env node
// make-icons.mjs — generate PWA icons from a source image.
//
// Usage:
//   node make-icons.mjs --src ./photo.jpg --out ./icons
//     [--crop-x 0.5]   horizontal centre of crop, 0..1 (default 0.5)
//     [--crop-y 0.5]   vertical centre of crop, 0..1 (default 0.5)
//     [--bg "#0b0b10"] background for maskable safe-zone padding
//
// Installs `sharp` on demand into a private cache if it isn't reachable from
// the current node_modules path. Outputs:
//   icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png

import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
if (!args.src || !args.out) {
  console.error("usage: node make-icons.mjs --src <image> --out <dir> [--crop-x 0.5] [--crop-y 0.5] [--bg #0b0b10]");
  process.exit(1);
}
const cropX = Number(args["crop-x"] ?? 0.5);
const cropY = Number(args["crop-y"] ?? 0.5);
const bgHex = String(args.bg ?? "#0b0b10");
const bg = parseHex(bgHex);

const sharp = await loadSharp();

mkdirSync(args.out, { recursive: true });

const meta = await sharp(args.src).metadata();
const side = Math.min(meta.width, meta.height);
const left = Math.round((meta.width - side) * clamp01(cropX));
const top = Math.round((meta.height - side) * clamp01(cropY));

const square = () => sharp(args.src).extract({ left, top, width: side, height: side });

for (const size of [192, 512]) {
  await square()
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(args.out, `icon-${size}.png`));
}
await square()
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(join(args.out, "apple-touch-icon.png"));

// Maskable: shrink the artwork into the safe zone (centre ~78%) and pad.
const maskable = 512;
const inner = Math.round(maskable * 0.78);
const pad = Math.round((maskable - inner) / 2);
await square()
  .resize(inner, inner)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
  .png({ compressionLevel: 9 })
  .toFile(join(args.out, "icon-maskable-512.png"));

console.log(`wrote 4 icons to ${args.out}`);

// ---------- helpers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) { out[k] = true; }
      else { out[k] = v; i++; }
    }
  }
  return out;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function parseHex(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return { r: 11, g: 11, b: 16, alpha: 1 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, alpha: 1 };
}

async function loadSharp() {
  try { return (await import("sharp")).default; } catch {}
  // Fall back to a private cache to avoid polluting the project.
  const here = dirname(fileURLToPath(import.meta.url));
  const cache = join(here, "..", ".cache");
  mkdirSync(cache, { recursive: true });
  const cachedPkg = join(cache, "node_modules", "sharp");
  if (!existsSync(cachedPkg)) {
    console.error("installing sharp into skill cache...");
    const r = spawnSync("npm", ["install", "--prefix", cache, "--silent", "sharp"], { stdio: "inherit" });
    if (r.status !== 0) {
      console.error("failed to install sharp. install it manually: npm install -g sharp");
      process.exit(2);
    }
  }
  return (await import(join(cachedPkg, "lib", "index.js"))).default;
}
