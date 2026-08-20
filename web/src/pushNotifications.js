import {
  isPushSupported,
  readPushEntryId,
  readPushPrefs,
  resolvePushApiBase,
  resolveVapidPublicKey,
  urlBase64ToUint8Array,
} from './pushNotificationStorage.js'

/**
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerPushServiceWorker() {
  if (!isPushSupported()) return null
  const scope = import.meta.env.BASE_URL || '/'
  const swUrl = `${scope}push-sw.js`
  return navigator.serviceWorker.register(swUrl, { scope })
}

/**
 * @returns {Promise<string>}
 */
async function fetchVapidPublicKey(apiBase) {
  const baked = resolveVapidPublicKey(import.meta.env.VITE_VAPID_PUBLIC_KEY)
  if (baked) return baked
  const res = await fetch(`${apiBase}/vapid-public-key`)
  if (!res.ok) throw new Error('Push API VAPID key is not configured')
  const data = await res.json()
  const key = String(data?.publicKey ?? '').trim()
  if (!key) throw new Error('Push API returned an empty VAPID key')
  return key
}

/**
 * @param {PushSubscription} subscription
 */
function subscriptionToPayload(subscription) {
  const json = subscription.toJSON()
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: json.keys,
    entryId: readPushEntryId(),
    prefs: readPushPrefs(),
  }
}

/**
 * @param {ServiceWorkerRegistration} registration
 * @param {string} apiBase
 */
export async function subscribeToPush(registration, apiBase) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted')
  }

  const publicKey = await fetchVapidPublicKey(apiBase)
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const res = await fetch(`${apiBase}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscriptionToPayload(subscription)),
  })
  if (!res.ok) {
    throw new Error(`Failed to register push subscription (${res.status})`)
  }
  return subscription
}

/**
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @param {string} apiBase
 */
export async function syncPushSubscription(registration, apiBase) {
  if (!registration) return null
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return null
  const res = await fetch(`${apiBase}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscriptionToPayload(subscription)),
  })
  if (!res.ok) throw new Error(`Failed to sync push subscription (${res.status})`)
  return subscription
}

/**
 * @param {ServiceWorkerRegistration | null | undefined} registration
 * @param {string} apiBase
 */
export async function unsubscribeFromPush(registration, apiBase) {
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null
  if (subscription) {
    if (apiBase) {
      await fetch(`${apiBase}/subscriptions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {})
    }
    await subscription.unsubscribe()
  }
}

/** @returns {{ supported: boolean, configured: boolean, apiBase: string }} */
export function getPushCapability() {
  const apiBase = resolvePushApiBase(import.meta.env.VITE_PUSH_API_URL)
  const vapid = resolveVapidPublicKey(import.meta.env.VITE_VAPID_PUBLIC_KEY)
  return {
    supported: isPushSupported(),
    configured: Boolean(apiBase && (vapid || apiBase)),
    apiBase,
  }
}

/**
 * Enable push end-to-end: SW register → permission → subscribe → POST.
 * @returns {Promise<{ registration: ServiceWorkerRegistration, subscription: PushSubscription }>}
 */
export async function enableWebPush() {
  const { supported, configured, apiBase } = getPushCapability()
  if (!supported) throw new Error('This browser does not support web push notifications')
  if (!configured || !apiBase) {
    throw new Error('Push notifications are not configured for this deploy')
  }
  const registration = await registerPushServiceWorker()
  if (!registration) throw new Error('Could not register the push service worker')
  const subscription = await subscribeToPush(registration, apiBase)
  return { registration, subscription }
}

/** Disable push and remove server subscription. */
export async function disableWebPush() {
  const apiBase = resolvePushApiBase(import.meta.env.VITE_PUSH_API_URL)
  const registration = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL || '/',
  )
  await unsubscribeFromPush(registration ?? null, apiBase)
}

/** Re-post prefs/entry changes for an existing browser subscription. */
export async function refreshPushRegistration() {
  const apiBase = resolvePushApiBase(import.meta.env.VITE_PUSH_API_URL)
  if (!apiBase) return null
  const registration = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL || '/',
  )
  return syncPushSubscription(registration ?? null, apiBase)
}
