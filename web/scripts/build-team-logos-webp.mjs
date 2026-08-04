#!/usr/bin/env node
/**
 * Pre-resizes team logos to 192×192 (cover) in public/team-logos-web/{id}.png.
 * Stops the browser from downscaling 2–4MP phone photos to ~60px (looks blurry).
 *
 * Sources:
 *  - `{id}.{ext}` files in public/team-logos/ (legacy / archive crests)
 *  - public/team-logos/manifest.json maps new-season entry ids → named files
 *    (Bilbo.JPG, …). Named art may live in team-logos/ or team-logos-web/.
 */
import {
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Jimp } from 'jimp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SRC = join(root, 'public/team-logos')
const OUT = join(root, 'public/team-logos-web')

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

/** Resolve a manifest filename from team-logos/ first, then team-logos-web/. */
function resolveNamedSource(filename) {
  const inSrc = join(SRC, filename)
  if (existsSync(inSrc)) return inSrc
  const inOut = join(OUT, filename)
  if (existsSync(inOut)) return inOut
  return null
}

async function writeCoverPng(inPath, outPath) {
  const st = statSync(inPath)
  if (existsSync(outPath) && statSync(outPath).mtimeMs >= st.mtimeMs) return false
  const img = await Jimp.read(inPath)
  await img.cover({ w: 192, h: 192 })
  await img.write(outPath)
  return true
}

async function main() {
  if (!existsSync(SRC)) return
  mkdirSync(OUT, { recursive: true })

  for (const f of readdirSync(SRC)) {
    if (!/^\d+\.[a-z0-9]+$/i.test(f)) continue
    const id = f.replace(/\.[^.]+$/, '')
    const inPath = join(SRC, f)
    const outPath = join(OUT, `${id}.png`)
    try {
      if (await writeCoverPng(inPath, outPath)) {
        console.log('team-logos-web:', `${id}.png`)
      }
    } catch (e) {
      console.warn('team-logos-web skip', f, e.message)
    }
  }

  const manifest = readJson(join(SRC, 'manifest.json'))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return

  for (const [id, filename] of Object.entries(manifest)) {
    if (!/^\d+$/.test(id) || typeof filename !== 'string' || !filename) continue
    const inPath = resolveNamedSource(filename)
    if (!inPath) {
      console.warn('team-logos-web manifest miss', id, filename)
      continue
    }
    const outPath = join(OUT, `${id}.png`)
    try {
      if (await writeCoverPng(inPath, outPath)) {
        console.log('team-logos-web:', `${id}.png`, '←', filename)
      }
    } catch (e) {
      console.warn('team-logos-web manifest skip', id, filename, e.message)
    }
  }
}

main()
