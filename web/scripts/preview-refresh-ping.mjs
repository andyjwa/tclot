#!/usr/bin/env node
/**
 * Backup clock for the weekly Preview. GitHub often drops the */15 and
 * top-of-hour schedules, so a separate workflow calls this a few times an
 * hour. If lineups just locked and the live weekly-recaps.json is still
 * from before that deadline, dispatch the full Pages deploy.
 *
 * Exit 0 when there is nothing to do. Exit 1 only when a needed dispatch fails.
 */
import process from 'node:process'
import { postLineupLockRefreshEvent } from '../src/waiverRefreshSchedule.js'
import { shouldDispatchPreview } from '../src/previewRefresh.js'

const BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'
const RECAPS = process.env.RECAPS_URL || 'https://tclot.vercel.app/league-data/weekly-recaps.json'
const REPO = process.env.GITHUB_REPOSITORY || 'andyjwa/tclot'
const WORKFLOW = 'deploy-github-pages.yml'

async function main() {
  const bootRes = await fetch(BOOTSTRAP, { headers: { Accept: 'application/json' } })
  if (!bootRes.ok) {
    console.error(`preview-refresh: bootstrap HTTP ${bootRes.status}`)
    process.exit(1)
  }
  const boot = await bootRes.json()
  const lock = postLineupLockRefreshEvent(boot?.events?.data, Date.now())
  if (!lock) {
    console.log('preview-refresh: outside lineup-lock window')
    return
  }

  let recaps = null
  try {
    const recRes = await fetch(RECAPS, { headers: { Accept: 'application/json' } })
    if (recRes.ok) recaps = await recRes.json()
    else console.warn(`preview-refresh: recaps HTTP ${recRes.status} — treating preview as stale`)
  } catch (err) {
    console.warn('preview-refresh: recaps fetch failed — treating preview as stale', err?.message ?? err)
  }

  if (!shouldDispatchPreview({ lock, recaps, lastDispatchMs: null, nowMs: Date.now() })) {
    console.log(`preview-refresh: GW${lock.id} preview already published`)
    return
  }

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    console.error('preview-refresh: GH_TOKEN / GITHUB_TOKEN missing — cannot dispatch')
    process.exit(1)
  }

  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'tclot-preview-refresh',
    },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (res.status !== 204) {
    const body = await res.text()
    console.error(`preview-refresh: dispatch HTTP ${res.status} ${body.slice(0, 300)}`)
    process.exit(1)
  }
  console.log(`preview-refresh: dispatched deploy for GW${lock.id} (deadline ${lock.deadline})`)
}

main().catch((err) => {
  console.error('preview-refresh:', err)
  process.exit(1)
})
