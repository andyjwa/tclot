/**
 * Builds hall-champions/essex-ratigans.png (600×900).
 * Uses the Ratigan source as a full raster (black field + white sticker edge kept as-is).
 *
 * Background: magenta / violet blend (#9e4d84) + grain.
 *
 * NOTE: Text (team name + season) used to be composited into this PNG
 * via Pacifico/Resvg. Removed in 2026-05 because the Trophy Room hero
 * is now an HTML-composed card (`TrophyBannerCard` in App.jsx) that
 * renders its own Bebas Neue title + year above and below the artwork.
 * Baking text in here produced a duplicate "Essex Ratigans" + "2020-2021"
 * underneath the HTML overlay. This script now emits only the gradient
 * base + character sprite — no text.
 *
 * Source: `source-assets/essex-ratigans-ratigan.png`
 *
 * Usage: node scripts/generate-essex-ratigans-banner.mjs
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Jimp, JimpMime } from 'jimp'
import { scaleSpriteToHeroBox } from './hall-banner-hero-scale.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const W = 600
const H = 900
/** Mid blend of #D1507C and #6B4B8B (cravat) */
const BG = '#9e4d84'

const SOURCE = join(__dirname, 'source-assets/essex-ratigans-ratigan.png')
const OUT = join(__dirname, '../public/hall-champions/essex-ratigans.png')

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
  scaleSpriteToHeroBox(sprite)

  const rh = sprite.bitmap.height
  const rw = sprite.bitmap.width
  const rx = Math.round((W - rw) / 2)
  const topBand = 108
  const bottomBand = 98
  const midH = H - topBand - bottomBand
  const ry = Math.max(topBand, Math.round(topBand + (midH - rh) / 2) - 28)

  const base = new Jimp({ width: W, height: H, color: BG })
  addMonoNoise(base, 10, 1)
  addMonoNoise(base, 5, 0.45)

  base.composite(sprite, rx, ry)

  await writeFile(OUT, await base.getBuffer(JimpMime.png))
  console.log('Wrote', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
