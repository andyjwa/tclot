/**
 * Cloudflare's 5-minute cron is a clock GitHub's scheduler does not control.
 * When a gameweek's lineups lock, ping a deploy if the live Preview is still
 * from before that deadline. Needs GITHUB_DISPATCH_TOKEN (workflow dispatch)
 * or VERCEL_DEPLOY_HOOK. Without either, this no-ops.
 */
import { postLineupLockRefreshEvent } from '../../../src/waiverRefreshSchedule.js'
import {
  previewAlreadyPublished,
  shouldDispatchPreview,
} from '../../../src/previewRefresh.js'

const BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'
export const DEFAULT_RECAPS_URL = 'https://tclot.vercel.app/league-data/weekly-recaps.json'
export const DEFAULT_REPO = 'andyjwa/tclot'
const KV_TTL_SEC = 14 * 24 * 60 * 60

function kvKey(gw) {
  return `preview-deploy:${gw}`
}

async function fetchEvents(fetchImpl) {
  const res = await fetchImpl(BOOTSTRAP, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`bootstrap HTTP ${res.status}`)
  const body = await res.json()
  const list = body?.events?.data
  if (!Array.isArray(list)) throw new Error('bootstrap missing events.data')
  return list
}

async function fetchRecaps(fetchImpl, url) {
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function dispatchGithub(fetchImpl, token, repo) {
  const res = await fetchImpl(
    `https://api.github.com/repos/${repo}/actions/workflows/deploy-github-pages.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'tclot-preview-refresh',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  )
  return { ok: res.status === 204, status: res.status, via: 'github' }
}

async function postHook(fetchImpl, hook) {
  const res = await fetchImpl(hook, { method: 'POST' })
  return { ok: res.status >= 200 && res.status < 300, status: res.status, via: 'vercel' }
}

/**
 * @param {object} env
 * @param {{
 *   now?: number,
 *   fetch?: typeof fetch,
 *   events?: object[],
 *   recaps?: object | null,
 *   lastDispatchMs?: number | null,
 * }} [deps]
 */
export async function maybeDispatchPreviewDeploy(env, deps = {}) {
  const now = deps.now ?? Date.now()
  const fetchImpl = deps.fetch ?? globalThis.fetch
  let events = deps.events
  if (!events) {
    try {
      events = await fetchEvents(fetchImpl)
    } catch (err) {
      console.error('preview-refresh: bootstrap failed', err?.message ?? err)
      return { action: 'error', reason: 'bootstrap' }
    }
  }

  const lock = postLineupLockRefreshEvent(events, now)
  if (!lock) return { action: 'skip', reason: 'outside-window' }

  const token = String(env?.GITHUB_DISPATCH_TOKEN ?? '').trim()
  const hook = String(env?.VERCEL_DEPLOY_HOOK ?? '').trim()
  if (!token && !hook) {
    console.log(`preview-refresh: GW${lock.id} lineups locked, no dispatch credentials`)
    return { action: 'skip', reason: 'no-credentials', gw: lock.id }
  }

  const recaps =
    deps.recaps !== undefined
      ? deps.recaps
      : await fetchRecaps(fetchImpl, env?.RECAPS_URL || DEFAULT_RECAPS_URL)
  const lastDispatchMs =
    deps.lastDispatchMs !== undefined
      ? deps.lastDispatchMs
      : Number(await env?.SUBSCRIPTIONS?.get?.(kvKey(lock.id)))
  if (!shouldDispatchPreview({ lock, recaps, lastDispatchMs, nowMs: now })) {
    return {
      action: 'skip',
      reason: previewAlreadyPublished(recaps, lock) ? 'published' : 'cooldown',
      gw: lock.id,
    }
  }

  const result = token
    ? await dispatchGithub(fetchImpl, token, env?.GITHUB_REPO || DEFAULT_REPO)
    : await postHook(fetchImpl, hook)
  if (!result.ok) {
    console.error(`preview-refresh: dispatch failed HTTP ${result.status}`)
    return { action: 'error', reason: 'dispatch', gw: lock.id, status: result.status }
  }

  await env?.SUBSCRIPTIONS?.put?.(kvKey(lock.id), String(now), { expirationTtl: KV_TTL_SEC })
  console.log(`preview-refresh: dispatched GW${lock.id} preview deploy via ${result.via}`)
  return { action: 'dispatched', gw: lock.id, via: result.via }
}
