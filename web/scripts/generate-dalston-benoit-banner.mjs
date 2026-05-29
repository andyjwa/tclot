/**
 * Builds hall-champions/dalston-benoit.png (600×900).
 * Keys out the outer black backdrop only (edge flood); keeps white sticker + subject.
 * Background matches `.hall-champion-banner__sheet` (App.css): 180deg #35302c → #252220 → #1c1a18.
 *
 * Source: `source-assets/dalston-benoit-chris.png`
 *
 * Usage: node scripts/generate-dalston-benoit-banner.mjs
 *
 * NOTE: This script previously baked the gold script "Dalston Benoit"
 * + "2022-23" text directly into the PNG via a Pacifico SVG overlay.
 * That layer was removed because the production TrophyBannerCard
 * component (web/src/App.jsx) renders the team name + season as
 * separate HTML bands above and below the artwork — keeping baked-in
 * text caused a duplicate-text effect. The PNG now contains only the
 * gradient base + character sprite; HTML composition handles all
 * text. (Pacifico-Regular.ttf is still in scripts/fonts/ as historical
 * reference but is no longer loaded.)
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Jimp, JimpMime } from 'jimp'
import { keyBlackConnectedToImageEdges } from './hall-banner-black-edge-key.mjs'
import { cropToOpaque, scaleSpriteToHeroBox } from './hall-banner-hero-scale.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const W = 600
const H = 900

const SOURCE = join(__dirname, 'source-assets/dalston-benoit-chris.png')
const OUT = join(__dirname, '../public/hall-champions/dalston-benoit.png')

function hexToRgb(hex) {
  const n = hex.replace('#', '')
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  }
}

/** Same stops as `App.css` `.hall-champion-banner__sheet` */
function createHallSheetGradientBase(width, height) {
  const c0 = hexToRgb('#35302c')
  const c1 = hexToRgb('#252220')
  const c2 = hexToRgb('#1c1a18')
  const yMid = Math.round((height - 1) * 0.48)
  const base = new Jimp({ width, height, color: '#252220' })
  const data = base.bitmap.data
  for (let y = 0; y < height; y++) {
    let r
    let g
    let b
    if (y <= yMid) {
      const t = yMid <= 0 ? 0 : y / yMid
      r = c0.r + (c1.r - c0.r) * t
      g = c0.g + (c1.g - c0.g) * t
      b = c0.b + (c1.b - c0.b) * t
    } else {
      const denom = height - 1 - yMid
      const t = denom <= 0 ? 0 : (y - yMid) / denom
      r = c1.r + (c2.r - c1.r) * t
      g = c1.g + (c2.g - c1.g) * t
      b = c1.b + (c2.b - c1.b) * t
    }
    r = Math.round(r)
    g = Math.round(g)
    b = Math.round(b)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return base
}

function addMonoNoise(jimp, amount, sizeMix = 1) {
  jimp.scan(function (_x, _y, idx) {
    const n = (Math.random() - 0.5) * amount * sizeMix
    const d = this.bitmap.data
    d[idx] = Math.min(255, Math.max(0, d[idx] + n))
    d[idx + 1] = Math.min(255, Math.max(0, d[idx + 1] + n))
    d[idx + 2] = Math.min(255, Math.max(0, d[idx + 2] + n))
  })
}

async function main() {
  const sprite = await Jimp.read(SOURCE)
  keyBlackConnectedToImageEdges(sprite)
  cropToOpaque(sprite)
  scaleSpriteToHeroBox(sprite)

  const rh = sprite.bitmap.height
  const rw = sprite.bitmap.width
  const rx = Math.round((W - rw) / 2)
  const topBand = 108
  const bottomBand = 98
  const midH = H - topBand - bottomBand
  const ry = Math.max(topBand, Math.round(topBand + (midH - rh) / 2) - 24)

  const base = createHallSheetGradientBase(W, H)
  addMonoNoise(base, 8, 1)
  addMonoNoise(base, 4, 0.45)

  base.composite(sprite, rx, ry)

  await writeFile(OUT, await base.getBuffer(JimpMime.png))
  console.log('Wrote', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
