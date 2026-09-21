#!/usr/bin/env node
/** GitHub Pages: serve SPA for unknown paths (e.g. refresh). */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'node:url'

const SOURCE_LOGO_EXTS = /\.(png|jpe?g|gif|webp|svg)$/i

export function writeSpaFallback(distDir) {
  const index = join(distDir, 'index.html')
  if (!existsSync(index)) return false
  copyFileSync(index, join(distDir, '404.html'))
  return true
}

/**
 * Design-mockup pages live in public/ so the dev server can screenshot them,
 * but they must not ship to the public site. Vite copies public/ wholesale
 * into dist/, so prune every root-level .html except the app entry points.
 */
export function pruneMockupHtml(distDir) {
  if (!existsSync(distDir)) return []
  const keep = new Set(['index.html', '404.html'])
  const pruned = readdirSync(distDir).filter(
    (f) => f.endsWith('.html') && !keep.has(f),
  )
  for (const f of pruned) rmSync(join(distDir, f))
  return pruned
}

/**
 * Source badge uploads are 2–3 MB phone photos. The site serves the 192×192
 * pipeline output in team-logos-web/. Leaving the originals in dist/ made
 * every Vercel deployment ~18 MB larger and blew the Hobby 10 GB storage cap.
 * Keep JSON manifests so logoMap / preseason splash still resolve.
 */
export function pruneSourceLogoUploads(distDir) {
  const dir = join(distDir, 'team-logos')
  if (!existsSync(dir)) return { files: [], bytes: 0 }
  const files = readdirSync(dir).filter((f) => SOURCE_LOGO_EXTS.test(f))
  let bytes = 0
  for (const f of files) {
    const p = join(dir, f)
    bytes += statSync(p).size
    rmSync(p)
  }
  return { files, bytes }
}

export function runPostbuild(distDir) {
  const wrote404 = writeSpaFallback(distDir)
  const mockups = pruneMockupHtml(distDir)
  const logos = pruneSourceLogoUploads(distDir)
  return { wrote404, mockups, logos }
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const dist = join(root, 'dist')
  const { wrote404, mockups, logos } = runPostbuild(dist)
  if (wrote404) console.log('postbuild: wrote dist/404.html (GitHub Pages)')
  if (mockups.length)
    console.log(`postbuild: pruned ${mockups.length} mockup .html page(s) from dist/`)
  if (logos.files.length) {
    const mb = (logos.bytes / (1024 * 1024)).toFixed(1)
    console.log(
      `postbuild: pruned ${logos.files.length} source team-logo upload(s) (${mb} MB) from dist/team-logos/`,
    )
  }
}
