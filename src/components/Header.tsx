import { familyDatabase } from '../data'
import { useAppNavigation } from '../context/AppNavigationContext'
import { useTimeline } from '../context/TimelineContext'
import type { AppView } from '../types/navigation'

const NAV_ITEMS: { label: string; view: AppView }[] = [
  { label: 'Journey', view: 'journey' },
  { label: 'People', view: 'people' },
  { label: 'Tree', view: 'tree' },
  { label: 'Map', view: 'map' },
  { label: 'About', view: 'about' },
]

function AtlasMark() {
  return (
    <div className="mark atlas-mark" aria-label="Atlas trail mark">
      <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true">
        <circle cx="18" cy="18" r="13.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        <path
          d="M7 24.5 Q18 19 29 24.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M18 24.5 V11.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M18 17.5 L11.5 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M18 15 L24.5 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="10" r="1.6" fill="currentColor" />
        <circle cx="11.5" cy="12.5" r="1.1" fill="currentColor" opacity="0.7" />
        <circle cx="24.5" cy="10" r="1.1" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  )
}

export function Header() {
  const { generationCount } = useTimeline()
  const { activeView, navigateToView } = useAppNavigation()
  const stats = familyDatabase.stats

  return (
    <header className="top">
      <div className="brand">
        <AtlasMark />
        <div>
          <h1 className="brand-title">Santa Ruiz Family Atlas</h1>
          <small>Every life leaves a trail</small>
        </div>
      </div>
      <div className="top-stats stats">
        <div className="stat">
          <strong>{stats.people}</strong>
          <span>people</span>
        </div>
        <div className="stat">
          <strong>{stats.families}</strong>
          <span>families</span>
        </div>
        <div className="stat">
          <strong>{generationCount}</strong>
          <span>generations</span>
        </div>
      </div>
      <nav className="nav" aria-label="Primary">
        {NAV_ITEMS.map(({ label, view }) => {
          const isActive = activeView === view
          return (
            <button
              key={view}
              type="button"
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigateToView(view)}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
