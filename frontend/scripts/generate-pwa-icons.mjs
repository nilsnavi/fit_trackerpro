import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

const BRAND = { r: 0x24, g: 0x81, b: 0xcc }

/** Sizes for favicon / browser tab */
const FAVICON_SIZES = [16, 32]

/**
 * PNG icons for manifest `purpose: any` and shortcuts.
 * Covers common Android / Chrome install + launcher densities.
 */
const APP_ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512]

/** Maskable icons (safe zone ~80% center) */
const MASKABLE_SIZES = [192, 512]

function fillSolid(png) {
  const { width: w, height: h, data } = png
  const { r, g, b } = BRAND
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) << 2
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }
}

/** Slightly lighter border outside ~80% safe zone for maskable previews */
function fillMaskable(png, size) {
  const pad = Math.round(size * 0.1)
  const inner = size - pad * 2
  const { r, g, b } = BRAND
  const { data } = png
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      const inSafe = x >= pad && x < pad + inner && y >= pad && y < pad + inner
      const ir = inSafe ? r : Math.min(255, r + 25)
      const ig = inSafe ? g : Math.min(255, g + 25)
      const ib = inSafe ? b : Math.min(255, b + 25)
      data[idx] = ir
      data[idx + 1] = ig
      data[idx + 2] = ib
      data[idx + 3] = 255
    }
  }
}

async function writeIcon(filename, size, mode) {
  await mkdir(iconsDir, { recursive: true })
  const png = new PNG({ width: size, height: size, colorType: 6 })
  if (mode === 'maskable') {
    fillMaskable(png, size)
  } else {
    fillSolid(png)
  }
  const full = join(iconsDir, filename)
  await new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(createWriteStream(full))
      .on('finish', resolve)
      .on('error', reject)
  })
  console.log('wrote', full)
}

for (const s of FAVICON_SIZES) {
  await writeIcon(`favicon-${s}.png`, s, 'solid')
}

for (const s of APP_ICON_SIZES) {
  await writeIcon(`icon-${s}.png`, s, 'solid')
}

for (const s of MASKABLE_SIZES) {
  await writeIcon(`icon-maskable-${s}.png`, s, 'maskable')
}

await writeIcon('apple-touch-icon-180.png', 180, 'solid')
