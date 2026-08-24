import { useEffect, useRef, useState } from 'react'
import { useFamilyData } from '../family-data/FamilyDataProvider'
import { useAppNavigation } from '../context/AppNavigationContext'
import { useTimeline } from '../context/TimelineContext'
import { AtlasReviewEntry } from '../atlas-review/AtlasReviewEntry'
import { EXPLORE_NAV, OWNER_ACTIONS, exploreMenuLabel } from '../navigation/atlasNav'
import { HeaderManageMenu } from './HeaderManageMenu'
import { useAtlasReview } from '../atlas-review/AtlasReviewRoot'
import { useManageFamilyTree } from '../atlas-manage/ManageFamilyTreeRoot'
import { reviewMenuCount } from '../atlas-review/customerReviewCopy'
import { usePhoneOverlayLock } from '../hooks/usePhoneOverlayLock'

export function Header() {
  const { database: familyDatabase } = useFamilyData()
  const { generationCount } = useTimeline()
  const { activeView, navigateToView } = useAppNavigation()
  const { count, openReview } = useAtlasReview()
  const { openManage } = useManageFamilyTree()
  const stats = familyDatabase.stats
  const [exploreOpen, setExploreOpen] = useState(false)
  const exploreRef = useRef<HTMLDivElement>(null)
  usePhoneOverlayLock(exploreOpen)
  const badge = reviewMenuCount(count)

  useEffect(() => {
    if (!exploreOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExploreOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      if (!exploreRef.current?.contains(event.target as Node)) setExploreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [exploreOpen])

  const goExplore = (view: (typeof EXPLORE_NAV)[number]['view']) => {
    navigateToView(view)
    setExploreOpen(false)
  }

  return (
    <header className="top">
      <div className="brand">
        <h1 className="brand-title">
          <span className="brand-title-full">Santa Ruiz Family Atlas</span>
          <span className="brand-title-short">Santa Ruiz</span>
        </h1>
        <small>Every life leaves a trail</small>
        <AtlasReviewEntry />
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
      <div className="top-nav" ref={exploreRef}>
        <button
          type="button"
          className="explore-toggle"
          aria-expanded={exploreOpen}
          aria-controls="atlas-explore-menu"
          aria-label={exploreMenuLabel()}
          onClick={() => setExploreOpen((open) => !open)}
        >
          <span className="explore-toggle-label">{exploreMenuLabel()}</span>
          <span className="explore-toggle-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <button
          type="button"
          className={`nav-menu-scrim${exploreOpen ? ' is-open' : ''}`}
          aria-label="Close menu"
          tabIndex={exploreOpen ? 0 : -1}
          onClick={() => setExploreOpen(false)}
        />
        <div className={`nav-cluster${exploreOpen ? ' is-open' : ''}`}>
          <nav
            id="atlas-explore-menu"
            className="nav"
            aria-label="Explore"
            data-nav-group="explore"
          >
            <p className="explore-menu-kicker">Explore</p>
            {EXPLORE_NAV.map(({ label, view }) => {
              const isActive = activeView === view
              return (
                <button
                  key={view}
                  type="button"
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => goExplore(view)}
                >
                  {label}
                </button>
              )
            })}
            <div className="explore-manage-block">
              <p className="explore-menu-kicker">Manage Atlas</p>
              {OWNER_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    setExploreOpen(false)
                    if (action.id === 'review') openReview()
                    if (action.id === 'update-tree') openManage()
                  }}
                >
                  {action.title}
                  {action.id === 'review' && badge ? (
                    <span className="header-manage-count">{badge}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </nav>
          <HeaderManageMenu />
        </div>
      </div>
    </header>
  )
}
