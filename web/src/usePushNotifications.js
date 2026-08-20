import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  disableWebPush,
  enableWebPush,
  getPushCapability,
  refreshPushRegistration,
} from './pushNotifications.js'
import {
  readPushEnabled,
  readPushEntryId,
  readPushPrefs,
  writePushEnabled,
  writePushEntryId,
  writePushPrefs,
} from './pushNotificationStorage.js'

/**
 * @param {{ leagueEntries?: Array<{ id: number, entry_name?: string }> }} [props]
 */
export function usePushNotifications({ leagueEntries = [] } = {}) {
  const capability = useMemo(() => getPushCapability(), [])
  const [enabled, setEnabledState] = useState(() => readPushEnabled())
  const [entryId, setEntryIdState] = useState(() => readPushEntryId())
  const [prefs, setPrefsState] = useState(() => readPushPrefs())
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !capability.configured) return undefined
    let cancelled = false
    refreshPushRegistration()
      .then(() => {
        if (!cancelled) setStatus('synced')
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err))
      })
    return () => {
      cancelled = true
    }
  }, [enabled, capability.configured, entryId, prefs])

  const setEnabled = useCallback(async (next) => {
    setError('')
    setStatus('working')
    try {
      if (next) {
        await enableWebPush()
        writePushEnabled(true)
        setEnabledState(true)
        setStatus('enabled')
      } else {
        await disableWebPush()
        writePushEnabled(false)
        setEnabledState(false)
        setStatus('disabled')
      }
    } catch (err) {
      writePushEnabled(false)
      setEnabledState(false)
      setStatus('error')
      setError(String(err?.message ?? err))
      throw err
    }
  }, [])

  const setEntryId = useCallback((next) => {
    const parsed = next == null || next === '' ? null : Number(next)
    const value = Number.isFinite(parsed) ? parsed : null
    writePushEntryId(value)
    setEntryIdState(value)
  }, [])

  const setPref = useCallback((key, value) => {
    const next = writePushPrefs({ [key]: value })
    setPrefsState(next)
  }, [])

  const teamOptions = useMemo(
    () =>
      (leagueEntries ?? [])
        .map((e) => ({
          value: String(e.id),
          label: e.entry_name ?? `Team ${e.id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [leagueEntries],
  )

  return {
    capability,
    enabled,
    entryId,
    prefs,
    status,
    error,
    setEnabled,
    setEntryId,
    setPref,
    teamOptions,
  }
}
