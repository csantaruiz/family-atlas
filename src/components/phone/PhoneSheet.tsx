import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePhoneOverlayLock } from '../../hooks/usePhoneOverlayLock'
import { PHONE_OVERLAY_MS, usePresence } from '../../hooks/usePresence'

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
  list = false,
}: {
  open: boolean
  title: string
  kicker?: string
  onClose: () => void
  children: ReactNode
  size?: 'auto' | 'compact' | 'full'
  placement?: 'panel' | 'sheet'
  titleSize?: 'default' | 'display'
  list?: boolean
}) {
  const { present, shown } = usePresence(open, PHONE_OVERLAY_MS)
  usePhoneOverlayLock(present)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)

  useEffect(() => {
    const node = bodyRef.current
    if (!present || !node) return
    const update = () => {
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight
      setAtEnd(remaining < 12)
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [present, children])

  if (!present) return null

  const sheetClass = [
    'phone-sheet',
    `phone-sheet--${placement}`,
    size === 'compact' ? 'phone-sheet--compact' : '',
    size === 'full' ? 'phone-sheet--full' : '',
    titleSize === 'display' ? 'phone-sheet--display' : '',
    list ? 'phone-sheet--list' : '',
    shown ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const sheet = (
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
        <div
          ref={bodyRef}
          className={`phone-sheet-body${list && !atEnd ? ' has-more' : ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
