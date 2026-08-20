/**
 * Settings rows for browser push notifications.
 * Matches Theme / Default landing tab: label on the left, control on the right.
 */

import { CompactSelectPill } from './CompactSelectPill.jsx'

/**
 * @param {{
 *   id: string,
 *   label: string,
 *   hint?: string,
 *   checked: boolean,
 *   disabled?: boolean,
 *   onChange: (next: boolean) => void,
 * }} props
 */
function SettingsToggleRow({ id, label, hint, checked, disabled, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <span className="settings-row__label" id={id}>
          {label}
        </span>
        {hint ? <p className="settings-row__hint">{hint}</p> : null}
      </div>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-labelledby={id}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="settings-toggle__track" aria-hidden="true" />
      </label>
    </div>
  )
}

/**
 * @param {{
 *   capability: { supported: boolean, configured: boolean, apiBase: string },
 *   enabled: boolean,
 *   entryId: number | null,
 *   prefs: { deadlineReminders: boolean, waiverResults: boolean, liveXi: boolean },
 *   status: string,
 *   error: string,
 *   setEnabled: (next: boolean) => Promise<void>,
 *   setEntryId: (next: string | number | null) => void,
 *   setPref: (key: string, value: boolean) => void,
 *   teamOptions: Array<{ value: string, label: string }>,
 * }} props
 */
export function PushNotificationSettings({
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
}) {
  const disabled = !capability.supported || !capability.configured

  let hint = 'Deadline, waiver, and live XI alerts from this web app.'
  if (!capability.supported) {
    hint = 'This browser does not support web push notifications.'
  } else if (!capability.configured) {
    hint = 'Push is not configured for this deploy (missing VITE_PUSH_API_URL / VITE_VAPID_PUBLIC_KEY).'
  }

  return (
    <>
      <SettingsToggleRow
        id="settings-push-label"
        label="Push notifications"
        hint={hint}
        checked={enabled}
        disabled={disabled || status === 'working'}
        onChange={(next) => {
          setEnabled(next).catch(() => {})
        }}
      />
      {error ? (
        <p className="settings-row__error" role="alert">
          {error}
        </p>
      ) : null}

      {enabled && !disabled ? (
        <>
          <div className="settings-row">
            <label className="settings-row__label" htmlFor="settings-push-team">
              My team
            </label>
            <CompactSelectPill
              id="settings-push-team"
              ariaLabel="My team for notifications"
              align="right"
              value={entryId == null ? '' : String(entryId)}
              onChange={(next) => setEntryId(next === '' ? null : next)}
              options={[
                { value: '', label: 'League-wide only' },
                ...teamOptions,
              ]}
            />
          </div>

          <SettingsToggleRow
            id="settings-push-deadlines"
            label="Deadline reminders"
            hint="Waivers and lineup lock — 24 hours and 1 hour before."
            checked={prefs.deadlineReminders}
            onChange={(next) => setPref('deadlineReminders', next)}
          />
          <SettingsToggleRow
            id="settings-push-waivers"
            label="Waiver results"
            hint="Once, after claims process."
            checked={prefs.waiverResults}
            onChange={(next) => setPref('waiverResults', next)}
          />
          <SettingsToggleRow
            id="settings-push-live-xi"
            label="Your live XI"
            hint={
              prefs.liveXi && entryId == null
                ? 'Pick My team above to receive these alerts.'
                : 'Goals, assists, and defcon for your starters.'
            }
            checked={prefs.liveXi}
            onChange={(next) => setPref('liveXi', next)}
          />
        </>
      ) : null}
    </>
  )
}
