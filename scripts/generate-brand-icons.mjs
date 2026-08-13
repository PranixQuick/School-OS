// scripts/generate-brand-icons.mjs
//
// WHY THIS EXISTS
// ---------------
// Two gaps, neither of which is "the wrong logo":
//
//  1. /favicon.ico returns 404. public/favicon.svg exists and modern crawlers
//     do use it (the purple "E" tile is what Google currently renders for
//     edprosys.com), but /favicon.ico is still the first thing many crawlers
//     and older browsers request, and a 404 there costs us the icon in those
//     surfaces for no reason.
//
//  2. public/icons/icon-192.svg and icon-512.svg are SVG. Chrome does not
//     accept SVG manifest icons for the Android install prompt, so the PWA had
//     no usable install icon. These are now emitted as PNG.
//
// public/favicon.svg is treated as the single source of truth, so the .ico, the
// manifest icons and the apple-touch icon can never drift apart. Wired in via
// the `prebuild` npm script so it cannot be skipped.
//
// NOTE ON BRANDING: this deliberately does NOT switch the icon to the EdProSys
// infinity mark in public/brand/. That mark is roughly 2:1 and highly detailed;
// squeezed into a 16px favicon it reads as an illegible smear, whereas the
// high-contrast "E" tile stays crisp. Changing which mark represents the brand
// in search results is a design decision, not a build fix — see the PR.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SVG = path.join(ROOT, 'public', 'favicon.svg')
const PUBLIC_DIR = path.join(ROOT, 'public')
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons')

function fail(msg) {
  console.error(`\n[brand-icons] FAILED: ${msg}\n`)
  process.exit(1)
}

/** Rasterise the master SVG to a square PNG at `size`. */
async function render(svg, size) {
  return sharp(Buffer.from(svg), { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Minimal ICO container. Googlebot, Bingbot and every current browser accept
 * PNG frames inside an .ico, so the PNGs are embedded verbatim rather than
 * re-encoded as legacy BMP.
 */
function buildIco(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // 1 = icon resource
  header.writeUInt16LE(frames.length, 4)

  const dir = Buffer.alloc(16 * frames.length)
  let offset = header.length + dir.length

  frames.forEach(({ size, buf }, i) => {
    const o = i * 16
    dir[o] = size >= 256 ? 0 : size // 0 encodes 256
    dir[o + 1] = size >= 256 ? 0 : size
    dir.writeUInt16LE(1, o + 4) // colour planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(buf.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += buf.length
  })

  return Buffer.concat([header, dir, ...frames.map((f) => f.buf)])
}

async function main() {
  if (!existsSync(SVG)) fail(`missing ${SVG}`)
  const svg = await readFile(SVG, 'utf8')
  if (!svg.includes('<svg')) fail('public/favicon.svg is not an SVG')

  await mkdir(ICONS_DIR, { recursive: true })
  console.log('[brand-icons] master artwork: public/favicon.svg')

  // PNG manifest icons — Chrome requires PNG for the Android install prompt.
  const targets = [
    [path.join(ICONS_DIR, 'icon-512.png'), 512],
    [path.join(ICONS_DIR, 'icon-192.png'), 192],
    [path.join(ICONS_DIR, 'icon-96.png'), 96],
    [path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 180],
  ]
  for (const [file, size] of targets) {
    await writeFile(file, await render(svg, size))
    console.log(`[brand-icons] ${path.relative(ROOT, file)} (${size}x${size})`)
  }

  // favicon.ico — the path most crawlers request first. Currently a 404.
  const frames = []
  for (const size of [16, 32, 48]) {
    frames.push({ size, buf: await render(svg, size) })
  }
  await writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), buildIco(frames))
  console.log('[brand-icons] public/favicon.ico (16/32/48) — was 404')

  for (const [file] of targets) {
    const meta = await sharp(file).metadata()
    if (meta.width !== meta.height) fail(`${path.relative(ROOT, file)} is not square`)
  }

  console.log('[brand-icons] done')
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)))
