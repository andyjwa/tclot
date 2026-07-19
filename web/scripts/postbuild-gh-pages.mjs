#!/usr/bin/env node
/** GitHub Pages: serve SPA for unknown paths (e.g. refresh). */
import { copyFileSync, existsSync, readdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const index = join(dist, 'index.html')
if (existsSync(index)) {
  copyFileSync(index, join(dist, '404.html'))
  console.log('postbuild: wrote dist/404.html (GitHub Pages)')
}

// Design-mockup pages live in public/ so the dev server can screenshot them,
// but they must not ship to the public site. Vite copies public/ wholesale
// into dist/, so prune every root-level .html except the app entry points.
const keep = new Set(['index.html', '404.html'])
const pruned = readdirSync(dist).filter(
  (f) => f.endsWith('.html') && !keep.has(f),
)
for (const f of pruned) rmSync(join(dist, f))
if (pruned.length)
  console.log(`postbuild: pruned ${pruned.length} mockup .html page(s) from dist/`)
