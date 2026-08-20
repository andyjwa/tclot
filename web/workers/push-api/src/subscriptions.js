/**
 * Push subscription persistence in Workers KV.
 */

const INDEX_KEY = 'subscriptions:index'

/** @param {string} endpoint */
export async function subscriptionIdForEndpoint(endpoint) {
  const data = new TextEncoder().encode(String(endpoint))
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex.slice(0, 32)
}

/**
 * @param {KVNamespace} kv
 * @returns {Promise<string[]>}
 */
async function readIndex(kv) {
  const raw = await kv.get(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** @param {KVNamespace} kv @param {string[]} ids */
async function writeIndex(kv, ids) {
  const unique = [...new Set(ids)]
  await kv.put(INDEX_KEY, JSON.stringify(unique))
}

/**
 * @param {KVNamespace} kv
 * @param {object} record
 */
export async function saveSubscription(kv, record) {
  const id = await subscriptionIdForEndpoint(record.endpoint)
  const key = `sub:${id}`
  await kv.put(key, JSON.stringify({ ...record, id, updatedAt: new Date().toISOString() }))
  const index = await readIndex(kv)
  if (!index.includes(id)) {
    index.push(id)
    await writeIndex(kv, index)
  }
  return id
}

/**
 * @param {KVNamespace} kv
 * @param {string} endpoint
 */
export async function deleteSubscription(kv, endpoint) {
  const id = await subscriptionIdForEndpoint(endpoint)
  const key = `sub:${id}`
  await kv.delete(key)
  const index = (await readIndex(kv)).filter((entry) => entry !== id)
  await writeIndex(kv, index)
  return id
}

/** @param {KVNamespace} kv @returns {Promise<object[]>} */
export async function listSubscriptions(kv) {
  const index = await readIndex(kv)
  const rows = []
  for (const id of index) {
    const raw = await kv.get(`sub:${id}`)
    if (!raw) continue
    try {
      rows.push(JSON.parse(raw))
    } catch {
      /* skip corrupt row */
    }
  }
  return rows
}

/** @param {KVNamespace} kv @param {string} dedupKey @param {number} ttlSeconds */
export async function markSentOnce(kv, dedupKey, ttlSeconds = 604800) {
  const key = `sent:${dedupKey}`
  const existing = await kv.get(key)
  if (existing) return false
  await kv.put(key, '1', { expirationTtl: ttlSeconds })
  return true
}
