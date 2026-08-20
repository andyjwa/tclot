import {
  deleteSubscription,
  listSubscriptions,
  saveSubscription,
} from './subscriptions.js'
import { runInternalNotification, runScheduledNotifications } from './cron.js'
import { runLiveXiNotifications } from './liveXi.js'

const DEFAULT_PREFS = {
  deadlineReminders: true,
  waiverResults: true,
  liveXi: true,
}

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin')
  const allow = env.ALLOW_ORIGIN?.trim() || origin || '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data, status, ch) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...ch, 'Content-Type': 'application/json' },
  })
}

/** @param {Request} request @param {object} env */
function assertInternalAuth(request, env) {
  const secret = String(env.PUSH_INTERNAL_SECRET ?? '').trim()
  if (!secret) return false
  const header = request.headers.get('Authorization') ?? ''
  return header === `Bearer ${secret}`
}

/** @param {unknown} body */
function normalizeSubscription(body) {
  if (!body || typeof body !== 'object') return null
  const endpoint = String(body.endpoint ?? '').trim()
  const keys = body.keys
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null
  const entryIdRaw = body.entryId
  const entryId =
    entryIdRaw == null || entryIdRaw === ''
      ? null
      : Number(entryIdRaw)
  const prefs = { ...DEFAULT_PREFS, ...(body.prefs ?? {}) }
  return {
    endpoint,
    expirationTime: body.expirationTime ?? null,
    keys: {
      p256dh: String(keys.p256dh),
      auth: String(keys.auth),
    },
    entryId: Number.isFinite(entryId) ? entryId : null,
    prefs,
  }
}

async function handleFetch(request, env) {
  const ch = corsHeaders(env, request)
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: ch })
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return json(
      {
        ok: true,
        vapidConfigured: Boolean(
          env.VAPID_SUBJECT &&
            env.VAPID_SERVER_PUBLIC_KEY &&
            env.VAPID_SERVER_PRIVATE_KEY,
        ),
      },
      200,
      ch,
    )
  }

  if (request.method === 'GET' && url.pathname === '/vapid-public-key') {
    const key = String(env.VAPID_SERVER_PUBLIC_KEY ?? '').trim()
    if (!key) return json({ error: 'VAPID not configured' }, 503, ch)
    return json({ publicKey: key }, 200, ch)
  }

  if (request.method === 'POST' && url.pathname === '/subscriptions') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400, ch)
    }
    const record = normalizeSubscription(body)
    if (!record) return json({ error: 'Invalid subscription payload' }, 400, ch)
    const id = await saveSubscription(env.SUBSCRIPTIONS, record)
    return json({ ok: true, id }, 201, ch)
  }

  if (request.method === 'DELETE' && url.pathname === '/subscriptions') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400, ch)
    }
    const endpoint = String(body?.endpoint ?? '').trim()
    if (!endpoint) return json({ error: 'Missing endpoint' }, 400, ch)
    await deleteSubscription(env.SUBSCRIPTIONS, endpoint)
    return json({ ok: true }, 200, ch)
  }

  if (request.method === 'POST' && url.pathname === '/internal/notify') {
    if (!assertInternalAuth(request, env)) {
      return json({ error: 'Unauthorized' }, 401, ch)
    }
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400, ch)
    }
    const subs = await listSubscriptions(env.SUBSCRIPTIONS)
    const result = await runInternalNotification(env, env.SUBSCRIPTIONS, subs, body)
    return json({ ok: true, result }, 200, ch)
  }

  return json({ error: 'Not found' }, 404, ch)
}

export default {
  fetch(request, env) {
    return handleFetch(request, env)
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const subs = await listSubscriptions(env.SUBSCRIPTIONS)
        if (!subs.length) return
        await runScheduledNotifications(env, env.SUBSCRIPTIONS, subs)
        await runLiveXiNotifications(env, env.SUBSCRIPTIONS, subs)
      })(),
    )
  },
}
