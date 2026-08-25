import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useAtlasReview } from '../atlas-review/AtlasReviewRoot'
import { reviewGearAriaLabel, reviewMenuCount, reviewMenuItemLabel } from '../atlas-review/customerReviewCopy'
import { manageCopy } from '../atlas-manage/customerCopy'
import { useManageFamilyTree } from '../atlas-manage/ManageFamilyTreeRoot'
import { OWNER_ACTIONS, type OwnerActionId } from '../navigation/atlasNav'
import { fetchEditStatus, ensureEditAccess } from '../utils/mediaApi'

function ManageGearIcon() {
  return (
    <svg className="header-manage-gear" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <g fill="currentColor">
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="10.5"
            y="2.1"
            width="3"
            height="5.2"
            rx="0.7"
            transform={`rotate(${i * 45} 12 12)`}
          />
        ))}
        <path
          fillRule="evenodd"
          d="M12 6.4a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2Zm0 2.85a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z"
        />
      </g>
    </svg>
  )
}

export function HeaderManageMenu() {
  const { count, openReview } = useAtlasReview()
  const { openManage } = useManageFamilyTree()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const badge = reviewMenuCount(count)

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector<HTMLButtonElement>('.header-manage-toggle')?.focus()
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    try {
      if (!(await fetchEditStatus())) await ensureEditAccess()
      if (await fetchEditStatus()) setOpen(true)
    } catch {
      setOpen(false)
    }
  }

  const runAction = (id: OwnerActionId) => {
    setOpen(false)
    if (id === 'review') openReview()
    if (id === 'update-tree') openManage()
  }

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    if (items.length === 0) return
    const index = items.findIndex((item) => item === document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      items[(index + 1 + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    }
    if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    }
    if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="header-manage" ref={rootRef} data-nav-group="manage">
      <button
        type="button"
        className="header-manage-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={reviewGearAriaLabel(count, manageCopy.menuLabel)}
        title={reviewGearAriaLabel(count, manageCopy.menuLabel)}
        onClick={() => void toggle()}
      >
        <span className="header-manage-gear-wrap">
          <ManageGearIcon />
          {badge ? <span className="header-manage-badge">{badge}</span> : null}
        </span>
      </button>
      {open ? (
        <div
          className="header-manage-menu"
          role="menu"
          aria-label={manageCopy.menuLabel}
          onKeyDown={onMenuKeyDown}
        >
          <p className="header-manage-heading">{manageCopy.menuLabel}</p>
          {OWNER_ACTIONS.map((action, index) => (
            <button
              key={action.id}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              className="header-manage-item"
              role="menuitem"
              onClick={() => runAction(action.id)}
            >
              <span className="header-manage-item-title">
                {action.id === 'review' ? reviewMenuItemLabel(count) : action.title}
              </span>
              <small>{action.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
