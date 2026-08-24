import type { ReactNode } from 'react'
import { usePhoneOverlayLock } from '../../hooks/usePhoneOverlayLock'
import { usePresence } from '../../hooks/usePresence'

export function PhoneCloseButton({
  onClick,
  label = 'Close',
  className = '',
  disabled = false,
}: {
  onClick: () => void
  label?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`phone-close${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" width="27" height="27" aria-hidden="true">
        <path
          d="M6 6 L18 18 M18 6 L6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}

export function PhoneSheet({
  open,
  title,
  kicker,
  onClose,
  children,
  size = 'auto',
  placement = 'panel',
  titleSize = 'default',
}: {
  open: boolean
  title: string
  kicker?: string
  onClose: () => void
  children: ReactNode
  size?: 'auto' | 'compact' | 'full'
  placement?: 'panel' | 'sheet'
  titleSize?: 'default' | 'display'
}) {
  const { present, shown } = usePresence(open)
  usePhoneOverlayLock(present)
  if (!present) return null

  const sheetClass = [
    'phone-sheet',
    `phone-sheet--${placement}`,
    size === 'compact' ? 'phone-sheet--compact' : '',
    size === 'full' ? 'phone-sheet--full' : '',
    titleSize === 'display' ? 'phone-sheet--display' : '',
    shown ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`phone-sheet-layer${shown ? ' is-open' : ''}`}>
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className={sheetClass} role="dialog" aria-modal="true" aria-label={title}>
        <div className="phone-sheet-head">
          <div className="phone-sheet-heading">
            <strong className="phone-sheet-title">{title}</strong>
            {kicker ? <p className="phone-sheet-kicker">{kicker}</p> : null}
          </div>
          <PhoneCloseButton onClick={onClose} />
        </div>
        <div className="phone-sheet-body">{children}</div>
      </div>
    </div>
  )
}
