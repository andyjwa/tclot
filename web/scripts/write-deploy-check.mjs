#!/usr/bin/env node
/** After build: dist/deploy-check.json — open on live site to debug data + logos */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const detailsPath = join(dist, 'league-data', 'details.json')

let leagueName = null
let teamCount = 0
let isDemo = false
let detailsBytes = 0

if (existsSync(detailsPath)) {
  detailsBytes = statSync(detailsPath).size
  try {
    const d = JSON.parse(readFileSync(detailsPath, 'utf8'))
    leagueName = d.league?.name ?? null
    teamCount = d.league_entries?.length ?? 0
    isDemo = d._tcMeta?.isSample === true
  } catch {
    /* ignore */
  }
}

let logoPngs = 0
const tl = join(dist, 'team-logos')
if (existsSync(tl)) {
  logoPngs = readdirSync(tl).filter((f) => /\.png$/i.test(f)).length
}

let webLogos = 0
const tw = join(dist, 'team-logos-web')
if (existsSync(tw)) {
  webLogos = readdirSync(tw).filter((f) => /\.png$/i.test(f)).length
}

const proxyUrl = (process.env.VITE_FPL_PROXY_URL || '').trim()
const liveProxyConfigured = proxyUrl.length > 0

const out = {
  leagueName,
  teamCount,
  isDemoData: isDemo,
  detailsJsonBytes: detailsBytes,
  teamLogosPngInDist: logoPngs,
  teamLogosWebInDist: webLogos,
  liveProxyConfigured,
  liveProxyHost: liveProxyConfigured
    ? (() => {
        try {
          return new URL(proxyUrl).host
        } catch {
          return '(invalid URL)'
        }
      })()
    : null,
  hint: isDemo
    ? 'Set GitHub Actions secret FPL_LEAGUE_ID or commit real web/public/league-data/'
    : logoPngs === 0
      ? 'Commit PNGs under web/public/team-logos/{entryId}.png then push'
      : !liveProxyConfigured
        ? 'Live tab: set VITE_FPL_PROXY_URL at build time (see DEPLOY.md) — deploy-check liveProxyConfigured is false'
        : 'OK',
}

writeFileSync(join(dist, 'deploy-check.json'), JSON.stringify(out, null, 2))
console.log('deploy-check.json:', out.hint)
