/**
 * Decide whether a lineup-lock window still needs a site rebuild so the
 * weekly Preview is baked. Shared by the backup GitHub ping and the
 * push-api cron. GitHub's high-frequency schedules are often dropped;
 * this is the check those backup clocks run before they dispatch a deploy.
 */

export const PREVIEW_DISPATCH_COOLDOWN_MS = 20 * 60 * 1000

/**
 * @param {{ generatedAt?: string, previews?: Array<{ gw?: number }> } | null | undefined} recaps
 * @param {{ id: number, deadline: string } | null | undefined} lock
 */
export function previewAlreadyPublished(recaps, lock) {
  if (!recaps || !lock) return false
  const generated = Date.parse(String(recaps.generatedAt ?? ''))
  const deadline = Date.parse(String(lock.deadline ?? ''))
  if (!Number.isFinite(generated) || !Number.isFinite(deadline) || generated < deadline) {
    return false
  }
  return (recaps.previews ?? []).some((p) => Number(p?.gw) === Number(lock.id))
}

/**
 * @param {{
 *   lock: { id: number, deadline: string } | null,
 *   recaps?: object | null,
 *   lastDispatchMs?: number | null,
 *   nowMs: number,
 *   cooldownMs?: number,
 * }} p
 */
export function shouldDispatchPreview({
  lock,
  recaps = null,
  lastDispatchMs = null,
  nowMs,
  cooldownMs = PREVIEW_DISPATCH_COOLDOWN_MS,
}) {
  if (!lock) return false
  if (previewAlreadyPublished(recaps, lock)) return false
  if (
    Number.isFinite(lastDispatchMs) &&
    Number.isFinite(nowMs) &&
    nowMs - lastDispatchMs < cooldownMs
  ) {
    return false
  }
  return true
}
