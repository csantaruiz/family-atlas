import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import { useTimeline } from '../context/TimelineContext'
import { familyDatabase } from '../data/familyDatabase'
import {
  DEFAULT_TIMELINE_FILTERS,
  TIMELINE_FILTER_GROUPS,
  TIMELINE_FILTER_LABELS,
  type TimelineFilterKey,
} from '../types/timelineFilters'
import { buildLineagePalette } from '../utils/lineageColors'

const ALL_FILTER_KEYS = Object.keys(DEFAULT_TIMELINE_FILTERS) as TimelineFilterKey[]
const BRANCH_FILTER_KEYS = new Set<TimelineFilterKey>(['paternal', 'maternal'])

const panelEase = [0.22, 0.8, 0.2, 1] as const

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
        initial: { opacity: 0, y: 14, scale: 0.94 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 10, scale: 0.96 },
      }

  const panelTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : {
        duration: 0.34,
        ease: panelEase,
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
            transition={panelTransition}
            style={{ transformOrigin: 'bottom center' }}
          >
            <TimelineFiltersPanel onClose={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TimelineFiltersPanel({ onClose }: TimelineFiltersPanelProps) {
  const { timelineFilters, setTimelineFilter, setTimelineFilters } = useTimeline()
  const masterCheckboxRef = useRef<HTMLInputElement>(null)

  const lineagePalette = useMemo(
    () => buildLineagePalette(familyDatabase.people, familyDatabase.root),
    [],
  )

  const branchMeta: Partial<Record<TimelineFilterKey, { surname: string; color: string }>> = useMemo(
    () => ({
      paternal: {
        surname: lineagePalette.paternal.label,
        color: lineagePalette.paternal.color,
      },
      maternal: {
        surname: lineagePalette.maternal.label,
        color: lineagePalette.maternal.color,
      },
    }),
    [lineagePalette],
  )

  const allSelected = useMemo(
    () => ALL_FILTER_KEYS.every((key) => timelineFilters[key]),
    [timelineFilters],
  )

  useEffect(() => {
    const master = masterCheckboxRef.current
    if (!master) return
    master.indeterminate = !allSelected && ALL_FILTER_KEYS.some((key) => timelineFilters[key])
  }, [timelineFilters, allSelected])

  const handleChange = (key: TimelineFilterKey, checked: boolean) => {
    setTimelineFilter(key, checked)
  }

  const handleToggleAll = () => {
    const nextValue = !allSelected
    setTimelineFilters(Object.fromEntries(ALL_FILTER_KEYS.map((key) => [key, nextValue])))
  }

  return (
    <div className="timeline-filters-panel-inner">
      <header className="timeline-filters-header">
        <span className="eyebrow">Refine the journey</span>
        <button type="button" className="timeline-filters-close" onClick={onClose} aria-label="Close filters">
          ×
        </button>
      </header>

      <div className="timeline-filters-toggle-all">
        <label className="timeline-filter-option timeline-filter-option--master">
          <input
            ref={masterCheckboxRef}
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
          />
          <span className="timeline-filter-check" aria-hidden="true" />
          <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
        </label>
      </div>

      {TIMELINE_FILTER_GROUPS.map((group) => (
        <section key={group.title} className="timeline-filters-group">
          <h3 className="timeline-filters-group-title">{group.title}</h3>
          <ul className="timeline-filters-list">
            {group.keys.map((key) => {
              const meta = BRANCH_FILTER_KEYS.has(key) ? branchMeta[key] : undefined
              return (
                <li key={key}>
                  <label className="timeline-filter-option">
                    <input
                      type="checkbox"
                      checked={timelineFilters[key]}
                      onChange={(e) => handleChange(key, e.target.checked)}
                    />
                    <span className="timeline-filter-check" aria-hidden="true" />
                    {meta ? (
                      <span className="timeline-filter-branch-label">
                        <span
                          className="timeline-filter-branch-swatch"
                          style={{ backgroundColor: meta.color }}
                          aria-hidden="true"
                        />
                        <span className="timeline-filter-branch-text">
                          <span>{TIMELINE_FILTER_LABELS[key]}</span>
                          <span className="timeline-filter-branch-surname">{meta.surname}</span>
                        </span>
                      </span>
                    ) : (
                      <span>{TIMELINE_FILTER_LABELS[key]}</span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
