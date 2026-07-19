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

export function Header() {
  const { generationCount } = useTimeline()
  const { activeView, navigateToView } = useAppNavigation()
  const stats = familyDatabase.stats

  return (
    <header className="top">
      <div className="brand">
        <h1 className="brand-title">Santa Ruiz Family Atlas</h1>
        <small>Every life leaves a trail</small>
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
