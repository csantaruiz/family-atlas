import type { ReactNode } from 'react'

export function PhoneCloseButton({
  onClick,
  label = 'Close',
  className = '',
}: {
  onClick: () => void
  label?: string
  className?: string
}) {
  return (
    <button type="button" className={`phone-close${className ? ` ${className}` : ''}`} onClick={onClick} aria-label={label}>
      ×
    </button>
  )
}

export function PhoneSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="phone-sheet-layer">
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="phone-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="phone-sheet-head">
          <strong>{title}</strong>
          <PhoneCloseButton onClick={onClose} />
        </div>
        <div className="phone-sheet-body">{children}</div>
      </div>
    </div>
  )
}
