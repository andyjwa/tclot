#!/usr/bin/env node
// Backup clock for the weekly Preview. GitHub often drops the 15-minute burst
// and top-of-hour schedules, so a separate workflow calls this a few times an
// hour. If lineups just locked (or the 12h catch-up window is still open) and
// the live weekly-recaps.json is still from before that deadline, dispatch the
// full Pages deploy.
//
// Use line comments, not a block comment: a cron example like */15 would close
// a /** ... */ comment early and crash this file on parse.
//
// Exit 0 when there is nothing to do. Exit 1 only when a needed dispatch fails.
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { previewCatchupEvent } from '../src/waiverRefreshSchedule.js'
import { shouldDispatchPreview } from '../src/previewRefresh.js'

const BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'
const RECAPS = process.env.RECAPS_URL || 'https://tclot.vercel.app/league-data/weekly-recaps.json'
const REPO = process.env.GITHUB_REPOSITORY || 'andyjwa/tclot'
const WORKFLOW = 'deploy-github-pages.yml'

export async function runPreviewRefreshPing({
  fetchImpl = fetch,
  now = Date.now(),
  env = process.env,
} = {}) {
  const bootRes = await fetchImpl(BOOTSTRAP, { headers: { Accept: 'application/json' } })
  if (!bootRes.ok) {
    console.error(`preview-refresh: bootstrap HTTP ${bootRes.status}`)
    return { action: 'error', reason: 'bootstrap', status: bootRes.status }
  }
  const boot = await bootRes.json()
  const lock = previewCatchupEvent(boot?.events?.data, now)
  if (!lock) {
    console.log('preview-refresh: outside lineup-lock catch-up window')
    return { action: 'skip', reason: 'outside-window' }
  }

  let recaps = null
  try {
    const recRes = await fetchImpl(RECAPS, { headers: { Accept: 'application/json' } })
    if (recRes.ok) recaps = await recRes.json()
    else console.warn(`preview-refresh: recaps HTTP ${recRes.status} — treating preview as stale`)
  } catch (err) {
    console.warn('preview-refresh: recaps fetch failed — treating preview as stale', err?.message ?? err)
  }

  if (!shouldDispatchPreview({ lock, recaps, lastDispatchMs: null, nowMs: now })) {
    console.log(`preview-refresh: GW${lock.id} preview already published`)
    return { action: 'skip', reason: 'published', gw: lock.id }
  }

  const token = env.GH_TOKEN || env.GITHUB_TOKEN
  if (!token) {
    console.error('preview-refresh: GH_TOKEN / GITHUB_TOKEN missing — cannot dispatch')
    return { action: 'error', reason: 'no-credentials', gw: lock.id }
  }

  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`
  const res = await fetchImpl(url, {
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
    return { action: 'error', reason: 'dispatch', gw: lock.id, status: res.status }
  }
  console.log(`preview-refresh: dispatched deploy for GW${lock.id} (deadline ${lock.deadline})`)
  return { action: 'dispatched', gw: lock.id }
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  runPreviewRefreshPing()
    .then((result) => {
      if (result?.action === 'error') process.exit(1)
    })
    .catch((err) => {
      console.error('preview-refresh:', err)
      process.exit(1)
    })
}
