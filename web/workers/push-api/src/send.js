import { buildPushPayload } from '@block65/webcrypto-web-push'

/**
 * @param {object} env
 * @param {import('@block65/webcrypto-web-push').PushSubscription} subscription
 * @param {{ title: string, body: string, url?: string, tag?: string }} notification
 */
export async function sendPush(env, subscription, notification) {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_SERVER_PUBLIC_KEY,
    privateKey: env.VAPID_SERVER_PRIVATE_KEY,
  }
  if (!vapid.subject || !vapid.publicKey || !vapid.privateKey) {
    throw new Error('VAPID secrets are not configured on the push worker')
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? '/',
    tag: notification.tag ?? 'tclot',
  })

  const requestInit = await buildPushPayload(
    {
      data: payload,
      options: { ttl: 86400, urgency: 'normal' },
    },
    subscription,
    vapid,
  )

  const res = await fetch(subscription.endpoint, requestInit)
  if (res.status === 404 || res.status === 410) {
    return { ok: false, gone: true, status: res.status }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, gone: false, status: res.status, error: text.slice(0, 200) }
  }
  return { ok: true, status: res.status }
}

/**
 * @param {object} env
 * @param {KVNamespace} kv
 * @param {object[]} subscriptions
 * @param {{ title: string, body: string, url?: string, tag?: string, pref?: string, entryId?: number | null }} notification
 */
export async function broadcastPush(env, kv, subscriptions, notification) {
  const results = { sent: 0, skipped: 0, failed: 0, removed: 0 }
  for (const row of subscriptions) {
    if (notification.pref && row.prefs?.[notification.pref] === false) {
      results.skipped += 1
      continue
    }
    if (
      notification.entryId != null &&
      row.entryId != null &&
      Number(row.entryId) !== Number(notification.entryId)
    ) {
      results.skipped += 1
      continue
    }

    const subscription = {
      endpoint: row.endpoint,
      expirationTime: row.expirationTime ?? null,
      keys: row.keys,
    }

    try {
      const outcome = await sendPush(env, subscription, notification)
      if (outcome.ok) {
        results.sent += 1
      } else if (outcome.gone) {
        await kv.delete(`sub:${row.id}`)
        results.removed += 1
      } else {
        results.failed += 1
      }
    } catch {
      results.failed += 1
    }
  }
  return results
}
