/**
 * CompactSelectPill — small "Label · Value ▾" pill dropdown.
 *
 * Replaces native <select> elements where a tight, brand-consistent trigger
 * is preferred over a full-row rounded select. Mirrors the structural and
 * keyboard conventions used by the Players workbench filter pills
 * (see playersFilterPills.jsx) so the entire site shares one dropdown
 * aesthetic.
 *
 * Visuals live in `App.css` under `.cpsp` / `.cpsp__*`.
 *
 * Props:
 *   - `label` (string, optional): muted left-side label, e.g. "Season".
 *     When provided the trigger renders `<label> · <value> ▾`. When omitted
 *     only the value + chevron are shown (use for value-only triggers).
 *   - `value` (string|number|null): the controlled selected value.
 *   - `options` ({ value, label, disabled? }[]): option list.
 *   - `onChange` (value => void): called when an option is picked.
 *   - `ariaLabel` (string, optional): button aria-label; defaults to label.
 *   - `placeholder` (string, optional): text shown when no option matches.
 *   - `isActive` (boolean, optional): force the violet "active" pill tint.
 *     Defaults to true when the selected option has a non-empty value.
 *   - `align` ('left'|'right', optional): menu alignment relative to button.
 *     Defaults to 'left'.
 *   - `id` (string, optional): id on the trigger button.
 *   - `className` (string, optional): extra class on the root wrapper.
 *   - `menuMaxWidth` (string|number, optional): CSS max-width for the menu.
 *
 * Keyboard:
 *   - ArrowDown / ArrowUp: move highlight in open menu
 *   - Home / End: jump to first / last option
 *   - Enter / Space: pick highlighted option (or open menu if closed)
 *   - Escape: close menu
 *   - Outside click / tap: close menu (matches `usePillMenuDismiss`)
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePillMenuDismiss } from './usePillMenuDismiss.js'

/**
 * @typedef {{
 *   value: string | number,
 *   label: string,
 *   disabled?: boolean,
 *   group?: string,
 * }} CompactSelectOption
 *
 * `group` lets the menu draw a small uppercase section header above the
 * first option in each group (used for FPL Live's Past / Current /
 * Upcoming game-week buckets, which were previously native <optgroup>s).
 */

/**
 * @param {{
 *   label?: string,
 *   value: string | number | null | undefined,
 *   options: CompactSelectOption[],
 *   onChange: (next: string | number) => void,
 *   ariaLabel?: string,
 *   placeholder?: string,
 *   isActive?: boolean,
 *   align?: 'left' | 'right',
 *   id?: string,
 *   className?: string,
 *   menuMaxWidth?: string | number,
 *   disabled?: boolean,
 * }} props
 */
export function CompactSelectPill({
  label,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select',
  isActive,
  align = 'left',
  id,
  className,
  menuMaxWidth,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const rootRef = useRef(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const reactId = useId()
  const menuId = `cpsp-menu-${id ?? reactId}`

  const dismiss = useCallback(() => {
    setOpen(false)
    setHighlightIdx(-1)
  }, [])

  usePillMenuDismiss(rootRef, open, dismiss)

  const selectedIndex = useMemo(() => {
    if (value == null) return -1
    return options.findIndex((opt) => String(opt.value) === String(value))
  }, [options, value])

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null
  const displayValue = selectedOption?.label ?? placeholder

  // Default "active" tint when something other than the first option is
  // selected. Caller can override via the `isActive` prop.
  const computedActive =
    typeof isActive === 'boolean'
      ? isActive
      : selectedOption != null &&
        selectedOption.value !== '' &&
        selectedOption.value !== null &&
        selectedOption.value !== undefined

  const openMenu = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setHighlightIdx(selectedIndex >= 0 ? selectedIndex : 0)
  }, [disabled, selectedIndex])

  const pick = useCallback(
    (idx) => {
      const opt = options[idx]
      if (!opt || opt.disabled) return
      onChange(opt.value)
      dismiss()
      // Restore focus to the button so keyboard users stay anchored.
      requestAnimationFrame(() => btnRef.current?.focus())
    },
    [options, onChange, dismiss],
  )

  const moveHighlight = useCallback(
    (delta) => {
      if (!options.length) return
      setHighlightIdx((prev) => {
        const start = prev < 0 ? (delta > 0 ? -1 : options.length) : prev
        let next = start
        for (let step = 0; step < options.length; step += 1) {
          next = (next + delta + options.length) % options.length
          if (!options[next]?.disabled) return next
        }
        return prev
      })
    },
    [options],
  )

  const onButtonKeyDown = useCallback(
    (ev) => {
      if (disabled) return
      if (open) {
        if (ev.key === 'ArrowDown') {
          ev.preventDefault()
          moveHighlight(1)
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault()
          moveHighlight(-1)
        } else if (ev.key === 'Home') {
          ev.preventDefault()
          setHighlightIdx(options.findIndex((o) => !o.disabled))
        } else if (ev.key === 'End') {
          ev.preventDefault()
          for (let i = options.length - 1; i >= 0; i -= 1) {
            if (!options[i]?.disabled) {
              setHighlightIdx(i)
              return
            }
          }
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          if (highlightIdx >= 0) pick(highlightIdx)
        } else if (ev.key === 'Tab') {
          dismiss()
        }
      } else {
        if (
          ev.key === 'Enter' ||
          ev.key === ' ' ||
          ev.key === 'ArrowDown' ||
          ev.key === 'ArrowUp'
        ) {
          ev.preventDefault()
          openMenu()
        }
      }
    },
    [disabled, open, moveHighlight, options, highlightIdx, pick, dismiss, openMenu],
  )

  // Keep the highlighted option scrolled into view when navigating with arrows.
  useEffect(() => {
    if (!open || highlightIdx < 0) return
    const menuEl = menuRef.current
    if (!menuEl) return
    const optionEl = menuEl.querySelector(
      `[data-cpsp-idx="${highlightIdx}"]`,
    )
    if (optionEl && typeof optionEl.scrollIntoView === 'function') {
      optionEl.scrollIntoView({ block: 'nearest' })
    }
  }, [open, highlightIdx])

  const buttonClass = [
    'cpsp__btn',
    open ? 'cpsp__btn--open' : '',
    computedActive ? 'cpsp__btn--active' : '',
    disabled ? 'cpsp__btn--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const rootClass = [
    'cpsp',
    align === 'right' ? 'cpsp--align-right' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const menuStyle =
    menuMaxWidth != null
      ? {
          maxWidth:
            typeof menuMaxWidth === 'number' ? `${menuMaxWidth}px` : menuMaxWidth,
        }
      : undefined

  const triggerAria = ariaLabel ?? label ?? 'Open menu'

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={btnRef}
        className={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={
          selectedOption ? `${triggerAria}: ${selectedOption.label}` : triggerAria
        }
        disabled={disabled}
        onClick={() => (open ? dismiss() : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        {label ? (
          <>
            <span className="cpsp__label">{label}</span>
            <span className="cpsp__sep" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span className="cpsp__value">{displayValue}</span>
        <span className="cpsp__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          ref={menuRef}
          id={menuId}
          className="cpsp__menu"
          role="listbox"
          aria-label={triggerAria}
          style={menuStyle}
        >
          {options.map((opt, idx) => {
            const active = idx === selectedIndex
            const highlighted = idx === highlightIdx
            const optClass = [
              'cpsp__option',
              active ? 'cpsp__option--active' : '',
              highlighted ? 'cpsp__option--highlighted' : '',
              opt.disabled ? 'cpsp__option--disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const prevGroup = idx > 0 ? options[idx - 1]?.group : undefined
            const showGroupHeader =
              opt.group != null && opt.group !== '' && opt.group !== prevGroup
            return (
              <Fragment key={`${opt.value}-${idx}`}>
                {showGroupHeader ? (
                  <li
                    role="presentation"
                    className="cpsp__group-header"
                    aria-hidden
                  >
                    {opt.group}
                  </li>
                ) : null}
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    data-cpsp-idx={idx}
                    aria-selected={active}
                    aria-disabled={opt.disabled || undefined}
                    className={optClass}
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => pick(idx)}
                  >
                    <span className="cpsp__option-text">{opt.label}</span>
                  </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
