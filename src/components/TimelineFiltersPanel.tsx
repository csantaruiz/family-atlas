import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useTimeline } from '../context/TimelineContext'
import {
  TIMELINE_FILTER_GROUPS,
  TIMELINE_FILTER_LABELS,
  type TimelineFilterKey,
} from '../types/timelineFilters'

function FilterIcon() {
  return (
    <svg
      className="filters-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3.5h12" />
      <path d="M4.5 8h7" />
      <path d="M6.5 12.5h3" />
    </svg>
  )
}

type TimelineFiltersPanelProps = {
  onClose: () => void
}

export function TimelineFiltersControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const panelMotion = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 6, scale: 0.97 },
      }

  return (
    <div className="filters-control-wrap" ref={wrapRef}>
      <button
        type="button"
        id="filtersBtn"
        className={`pill layer-toggle filters-toggle${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
      >
        <FilterIcon />
        Filters
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Timeline filters"
            className="timeline-filters-panel"
            {...panelMotion}
            transition={{ duration: 0.22, ease: [0.22, 0.8, 0.2, 1] }}
          >
            <TimelineFiltersPanel onClose={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TimelineFiltersPanel({ onClose }: TimelineFiltersPanelProps) {
  const { timelineFilters, setTimelineFilter } = useTimeline()

  const handleChange = (key: TimelineFilterKey, checked: boolean) => {
    setTimelineFilter(key, checked)
  }

  return (
    <div className="timeline-filters-panel-inner">
      <header className="timeline-filters-header">
        <span className="eyebrow">Refine the journey</span>
        <button type="button" className="timeline-filters-close" onClick={onClose} aria-label="Close filters">
          ×
        </button>
      </header>

      {TIMELINE_FILTER_GROUPS.map((group) => (
        <section key={group.title} className="timeline-filters-group">
          <h3 className="timeline-filters-group-title">{group.title}</h3>
          <ul className="timeline-filters-list">
            {group.keys.map((key) => (
              <li key={key}>
                <label className="timeline-filter-option">
                  <input
                    type="checkbox"
                    checked={timelineFilters[key]}
                    onChange={(e) => handleChange(key, e.target.checked)}
                  />
                  <span className="timeline-filter-check" aria-hidden="true" />
                  <span>{TIMELINE_FILTER_LABELS[key]}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
