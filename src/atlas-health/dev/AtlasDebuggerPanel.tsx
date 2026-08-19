import { useMemo, useState } from 'react'
import { familyDatabase } from '../../data/familyDatabase'
import { useTimeline } from '../../context/TimelineContext'
import { canonicalEventId } from '../../utils/canonicalEvent'
import { viewport } from '../../utils/timelineMath'
import {
  buildPlaceResolutionRecord,
  explainEventVisibility,
  findEventsForPerson,
  listFamilyEvents,
  runAtlasHealthCheck,
  type EventLifecycleRecord,
  type PlaceResolutionRecord,
} from '../index'
import { isAtlasDebugEnabled } from './atlasDebugEnabled'
import { isUnifiedPlacesEnabled } from '../../places/featureFlag'

type Tab = 'health' | 'person' | 'event' | 'place'

function PlaceRecordView({ record }: { record: PlaceResolutionRecord }) {
  return (
    <div className="atlas-debug-block">
      <dl className="atlas-debug-dl">
        <dt>Original</dt>
        <dd>{record.original || '—'}</dd>
        <dt>Normalized</dt>
        <dd>{record.normalized || '—'}</dd>
        <dt>Unified (shadow)</dt>
        <dd
          className={
            record.unifiedComparison.category === 'UNIFIED_REGRESSION'
              ? 'atlas-debug-danger'
              : record.unifiedComparison.category === 'UNIFIED_CORRECTS_LEGACY'
                ? undefined
                : undefined
          }
        >
          {record.unified.status === 'ambiguous'
            ? 'ambiguous'
            : record.unified.status === 'resolved' || record.unified.status === 'coarse'
              ? record.unified.label
              : record.unified.status}{' '}
          · {record.unified.method} · {record.unified.confidence} · {record.unified.precision}
        </dd>
        <dt>Unified coords</dt>
        <dd>
          {record.unified.latitude != null
            ? `${record.unified.latitude.toFixed(3)}, ${record.unified.longitude?.toFixed(3)}`
            : record.unified.status === 'ambiguous'
              ? `${record.unified.alternatives.length} alternative(s)`
              : '—'}
          {record.unified.projected
            ? ` · projected (${record.unified.projected.x.toFixed(1)}, ${record.unified.projected.y.toFixed(1)})`
            : ''}
        </dd>
        <dt>Unified vs legacy</dt>
        <dd
          className={
            record.unifiedComparison.category === 'UNIFIED_REGRESSION'
              ? 'atlas-debug-danger'
              : undefined
          }
        >
          {record.unifiedComparison.category}: {record.unifiedComparison.summary}
        </dd>
        <dt>Explore</dt>
        <dd>
          {record.explore.resolved ? record.explore.label : 'unresolved'} · {record.explore.method} ·{' '}
          {record.explore.confidence}
        </dd>
        <dt>Explore coords</dt>
        <dd>
          {record.explore.latitude != null
            ? `${record.explore.latitude.toFixed(3)}, ${record.explore.longitude?.toFixed(3)}`
            : '—'}
          {record.explore.projectedX != null
            ? ` · projected (${record.explore.projectedX.toFixed(1)}, ${record.explore.projectedY?.toFixed(1)})`
            : ''}
        </dd>
        <dt>Documentary</dt>
        <dd>
          {record.documentary.resolved
            ? `${record.documentary.label} (${record.documentary.canonicalId})`
            : 'unresolved'}{' '}
          · {record.documentary.method} · {record.documentary.confidence}
          {record.documentary.documentaryConfidenceRaw
            ? ` [raw ${record.documentary.documentaryConfidenceRaw}]`
            : ''}
        </dd>
        <dt>Documentary coords</dt>
        <dd>
          {record.documentary.latitude != null
            ? `${record.documentary.latitude.toFixed(3)}, ${record.documentary.longitude?.toFixed(3)}`
            : '—'}
        </dd>
        <dt>Explore precision</dt>
        <dd>{record.explore.precision}</dd>
        <dt>Documentary precision</dt>
        <dd>{record.documentary.precision}</dd>
        <dt>Comparison</dt>
        <dd
          className={
            record.comparison.category !== 'AGREEMENT' ? 'atlas-debug-warn' : undefined
          }
        >
          {record.comparison.category}
          {record.comparison.summary ? `: ${record.comparison.summary}` : ''}
        </dd>
        <dt>Notes</dt>
        <dd>
          {[...record.explore.notes, ...record.documentary.notes].join(' ') || '—'}
        </dd>
      </dl>
    </div>
  )
}

function EventRecordView({ record }: { record: EventLifecycleRecord }) {
  return (
    <div className="atlas-debug-block">
      <dl className="atlas-debug-dl">
        <dt>Event</dt>
        <dd>
          {record.title} · {record.kind} · {record.year}
        </dd>
        <dt>Person</dt>
        <dd>
          {record.personName} ({record.personId})
        </dd>
        <dt>Canonical id</dt>
        <dd>
          <code>{record.eventId}</code>
        </dd>
        <dt>Synthesis</dt>
        <dd>
          {record.synthesis.kind}
          <div className="atlas-debug-muted">{record.synthesis.notes.join(' ')}</div>
        </dd>
        <dt>Place</dt>
        <dd>{record.placeRaw || '—'}</dd>
        <dt>Filter</dt>
        <dd>
          {record.filterPassed ? 'pass' : 'fail'} — {record.filterNotes.join(' ')}
        </dd>
        <dt>Viewport</dt>
        <dd>{record.withinViewport ? 'in window' : 'outside window'}</dd>
        <dt>Semantic zoom</dt>
        <dd>
          {record.semanticZoomMode ?? '—'}
          {record.birthPeriodClusterMode ? ' · birth-period clusters' : ''}
        </dd>
        <dt>Importance</dt>
        <dd>
          base {record.importanceBase}
          {record.importanceLayoutScore != null ? ` · layout ${record.importanceLayoutScore}` : ''}
        </dd>
        <dt>Selection / placement</dt>
        <dd>
          landmark {record.selectedAsLandmark ? 'yes' : 'no'} · placed{' '}
          {record.placedInLayout ? 'yes' : 'no'} · admitted {record.admittedAfterCap ? 'yes' : 'no'}
        </dd>
        <dt>Cluster / fold</dt>
        <dd>
          folded {record.conflictFolded ? `yes (${record.conflictClusterId})` : 'no'}
          {record.chapterClusterId
            ? ` · chapter ${record.chapterClusterId} hidden≈${record.chapterHiddenCount}`
            : ''}
        </dd>
        <dt>Final visibility</dt>
        <dd>{record.finallyVisible ? 'VISIBLE' : 'HIDDEN'}</dd>
        <dt>Hidden reason</dt>
        <dd>{record.hiddenReason}</dd>
        <dt>Classification</dt>
        <dd
          className={
            record.classification === 'BUG_SUSPECTED'
              ? 'atlas-debug-danger'
              : record.classification === 'SUSPICIOUS'
                ? 'atlas-debug-warn'
                : undefined
          }
        >
          {record.classification}
        </dd>
        <dt>Summary</dt>
        <dd>{record.summary}</dd>
      </dl>
      {record.placeResolution ? (
        <>
          <h4 className="atlas-debug-subhead">Attached place resolution</h4>
          <PlaceRecordView record={record.placeResolution} />
        </>
      ) : null}
    </div>
  )
}

export function AtlasDebuggerPanel() {
  const enabled = isAtlasDebugEnabled()
  const timeline = useTimeline()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('health')
  const [personQuery, setPersonQuery] = useState('')
  const [eventQuery, setEventQuery] = useState('')
  const [placeQuery, setPlaceQuery] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [healthRan, setHealthRan] = useState(false)

  const health = useMemo(() => {
    if (!enabled || !healthRan) return null
    return runAtlasHealthCheck()
  }, [enabled, healthRan])

  const { start, end } = useMemo(
    () => viewport(timeline.center, timeline.span),
    [timeline.center, timeline.span],
  )

  const personMatches = useMemo(() => {
    const q = personQuery.trim().toLowerCase()
    if (!q) return []
    return familyDatabase.people
      .filter(
        (person) =>
          person.name.toLowerCase().includes(q) || person.id.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [personQuery])

  const personEvents = useMemo(() => {
    if (!selectedPersonId) return []
    return findEventsForPerson(selectedPersonId)
  }, [selectedPersonId])

  const eventLifecycle = useMemo(() => {
    if (!selectedEventId || !enabled) return null
    // Approximate stage size for offline layout — debugger is on-demand only.
    const width = typeof window !== 'undefined' ? Math.min(1400, window.innerWidth) : 1200
    const height = typeof window !== 'undefined' ? Math.min(900, window.innerHeight) : 800
    return explainEventVisibility({
      eventId: selectedEventId,
      start,
      end,
      span: timeline.span,
      width,
      height,
      fullSpan: timeline.fullSpan,
      earliestYear: timeline.minYear,
      presentYear: timeline.presentYear,
      rootPersonId: familyDatabase.root,
      filters: timeline.timelineFilters,
    })
  }, [
    selectedEventId,
    enabled,
    start,
    end,
    timeline.span,
    timeline.fullSpan,
    timeline.minYear,
    timeline.presentYear,
    timeline.timelineFilters,
  ])

  const placeRecord = useMemo(() => {
    const q = placeQuery.trim()
    if (!q) return null
    return buildPlaceResolutionRecord(q)
  }, [placeQuery])

  const eventMatches = useMemo(() => {
    const q = eventQuery.trim().toLowerCase()
    if (!q) return []
    return listFamilyEvents()
      .filter((event) => {
        const id = canonicalEventId(event)
        return (
          event.title.toLowerCase().includes(q) ||
          event.person.name.toLowerCase().includes(q) ||
          id.toLowerCase().includes(q) ||
          String(event.year).includes(q)
        )
      })
      .slice(0, 16)
  }, [eventQuery])

  const unifiedPlacesLive = isUnifiedPlacesEnabled()

  if (!enabled || !open) {
    if (!enabled) return null
    return (
      <button type="button" className="atlas-debug-launcher" onClick={() => setOpen(true)}>
        Atlas Debug
      </button>
    )
  }

  return (
    <aside className="atlas-debug-panel" aria-label="Atlas debugger">
      <header className="atlas-debug-header">
        <strong>Atlas Debugger</strong>
        <span className="atlas-debug-muted">?atlasDebug=1 · observation only</span>
        <button type="button" className="atlas-debug-close" onClick={() => setOpen(false)}>
          Hide
        </button>
      </header>

      <nav className="atlas-debug-tabs">
        {(['health', 'person', 'event', 'place'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'is-active' : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {unifiedPlacesLive ? (
        <p className="atlas-debug-muted atlas-debug-banner">
          Explore Map is using unified places (?unifiedPlaces=1). Place tab still compares legacy
          Explore, legacy Documentary, and unified shadow.
        </p>
      ) : null}

      <div className="atlas-debug-body">
        {tab === 'health' ? (
          <div>
            <p className="atlas-debug-muted">
              Runs a full place/event aggregation on demand. Not tied to pan/zoom.
            </p>
            <button type="button" className="atlas-debug-action" onClick={() => setHealthRan(true)}>
              Run Atlas Health Check
            </button>
            {health ? (
              <div className="atlas-debug-block">
                <dl className="atlas-debug-dl">
                  <dt>People</dt>
                  <dd>{health.people}</dd>
                  <dt>Events</dt>
                  <dd>
                    {health.events.totalEvents} (inferred moves {health.events.inferredMoves},
                    curated services {health.events.curatedServices}, marriages{' '}
                    {health.events.curatedMarriages})
                  </dd>
                  <dt>Places</dt>
                  <dd>
                    {health.places.uniquePlaceStrings} unique · explore resolved{' '}
                    {health.places.exploreResolved}/{health.places.uniquePlaceStrings} · documentary{' '}
                    {health.places.documentaryResolved}/{health.places.uniquePlaceStrings}
                  </dd>
                  <dt>Place comparisons</dt>
                  <dd>
                    {health.places.comparisonCounts.AGREEMENT} agree ·{' '}
                    <span className={health.places.comparisonCounts.GEOGRAPHIC_CONFLICT ? 'atlas-debug-danger' : undefined}>
                      {health.places.comparisonCounts.GEOGRAPHIC_CONFLICT} geographic conflict
                    </span>
                    {' · '}
                    {health.places.comparisonCounts.RESOLUTION_GAP} resolution gap ·{' '}
                    {health.places.comparisonCounts.PRECISION_MISMATCH} precision mismatch ·{' '}
                    {health.places.comparisonCounts.CONFIDENCE_MISMATCH} confidence only
                  </dd>
                  <dt>Actionable findings</dt>
                  <dd className={health.places.actionableFindings ? 'atlas-debug-warn' : undefined}>
                    {health.places.actionableFindings}
                  </dd>
                  <dt>Unified shadow</dt>
                  <dd>
                    {health.places.unifiedResolved} resolved · {health.places.unifiedCoarse} coarse ·{' '}
                    {health.places.unifiedAmbiguous} ambiguous · {health.places.unifiedUnresolved}{' '}
                    unresolved ·{' '}
                    <span className={health.places.unifiedRegressions ? 'atlas-debug-danger' : undefined}>
                      {health.places.unifiedRegressions} regressions
                    </span>{' '}
                    · {health.places.unifiedCorrections} corrections
                  </dd>
                  <dt>Photos (curated files)</dt>
                  <dd>{health.photographsCuratedHint ?? '—'}</dd>
                </dl>
                {health.priorityPlaces.length ? (
                  <>
                    <h4 className="atlas-debug-subhead">Priority places (conflict + resolution gap)</h4>
                    <ul className="atlas-debug-list">
                      {health.priorityPlaces.slice(0, 40).map((item) => (
                        <li key={item.original}>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaceQuery(item.original)
                              setTab('place')
                            }}
                          >
                            {item.original}
                          </button>
                          <div className="atlas-debug-muted">
                            {item.category}: {item.summary}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {health.placeFindings.length ? (
                  <>
                    <h4 className="atlas-debug-subhead">All actionable findings (by severity)</h4>
                    <ul className="atlas-debug-list">
                      {health.placeFindings.slice(0, 40).map((item) => (
                        <li key={`f-${item.original}-${item.category}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaceQuery(item.original)
                              setTab('place')
                            }}
                          >
                            {item.original}
                          </button>
                          <div className="atlas-debug-muted">
                            {item.category} · explore {item.explorePrecision} · doc{' '}
                            {item.documentaryPrecision}
                          </div>
                          <div className="atlas-debug-muted">{item.summary}</div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'person' ? (
          <div>
            <input
              className="atlas-debug-input"
              placeholder="Search person name or id"
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
            />
            <ul className="atlas-debug-list">
              {personMatches.map((person) => (
                <li key={person.id}>
                  <button type="button" onClick={() => setSelectedPersonId(person.id)}>
                    {person.name} <span className="atlas-debug-muted">{person.id}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedPersonId ? (
              <div className="atlas-debug-block">
                <h4 className="atlas-debug-subhead">Events for person</h4>
                <ul className="atlas-debug-list">
                  {personEvents.map((event) => {
                    const id = canonicalEventId(event)
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventId(id)
                            setTab('event')
                          }}
                        >
                          {event.year} · {event.kind} · {event.title}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <h4 className="atlas-debug-subhead">Places on person</h4>
                <ul className="atlas-debug-list">
                  {[
                    familyDatabase.people.find((p) => p.id === selectedPersonId)?.birthPlace,
                    familyDatabase.people.find((p) => p.id === selectedPersonId)?.deathPlace,
                    ...(familyDatabase.people.find((p) => p.id === selectedPersonId)?.places ?? []),
                  ]
                    .filter((value): value is string => Boolean(value?.trim()))
                    .filter((value, index, arr) => arr.indexOf(value) === index)
                    .map((place) => (
                      <li key={place}>
                        <button
                          type="button"
                          onClick={() => {
                            setPlaceQuery(place)
                            setTab('place')
                          }}
                        >
                          {place}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'event' ? (
          <div>
            <p className="atlas-debug-muted">
              Explains visibility for the current timeline window ({Math.round(start)}–
              {Math.round(end)}, span {Math.round(timeline.span)}).
            </p>
            <input
              className="atlas-debug-input"
              placeholder="Search event title, person, year, or id"
              value={eventQuery}
              onChange={(e) => setEventQuery(e.target.value)}
            />
            <ul className="atlas-debug-list">
              {eventMatches.map((event) => {
                const id = canonicalEventId(event)
                return (
                  <li key={id}>
                    <button type="button" onClick={() => setSelectedEventId(id)}>
                      {event.year} · {event.person.name} · {event.kind}
                    </button>
                  </li>
                )
              })}
            </ul>
            {eventLifecycle ? <EventRecordView record={eventLifecycle} /> : null}
          </div>
        ) : null}

        {tab === 'place' ? (
          <div>
            <input
              className="atlas-debug-input"
              placeholder="Paste a GEDCOM place string"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            {placeRecord ? <PlaceRecordView record={placeRecord} /> : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
