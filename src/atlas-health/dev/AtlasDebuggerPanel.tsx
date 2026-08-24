import { useEffect, useMemo, useState } from 'react'
import { useFamilyData } from '../../family-data/FamilyDataProvider'
import { useTimeline } from '../../context/TimelineContext'
import { canonicalEventId } from '../../utils/canonicalEvent'
import { viewport } from '../../utils/timelineMath'
import type { FamilyEvent } from '../../types'
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
import { resolveAtlasPlace } from '../../overrides/resolveAtlasPlace'
import { resolveAtlasEvent } from '../../overrides/applyEventOverrides'
import {
  placeEntityKey,
  placeSourceSignature,
  eventEntityKey,
  eventFingerprint,
} from '../../overrides/identity'
import {
  cacheUpsert,
  cacheRevert,
  ensureOverrideCacheLoaded,
  getCachedPlaceOverride,
} from '../../overrides/overrideCache'
import { upsertOverrideRemote, revertOverrideRemote, fetchOverrides } from '../../overrides/overrideApi'
import { resolveCanonicalPlaceSync } from '../../places/resolveCanonicalPlace'
import { ReviewFindingsPanel } from './ReviewFindingsPanel'
import { buildReviewQueue } from './reviewFindingsModel'
import { resolvePersonDateOverride } from '../../overrides/applyPersonDateOverrides'
import { resolvePersonNameOverride } from '../../overrides/applyPersonNameOverrides'
import { getFamilyDatabase } from '../../family-data/activeFamily'

type Tab = 'health' | 'person' | 'event' | 'place'
type HealthMode = 'summary' | 'review'

function PersonNameOverrideNote({ personId }: { personId: string }) {
  const person = getFamilyDatabase().people.find((row) => row.id === personId)
  if (!person) return null
  const resolved = resolvePersonNameOverride(person)
  const source = person.nameOverrideSource?.originalDisplay ?? person.name
  return (
    <div className="atlas-debug-muted">
      source: {source || '—'} · effective: {person.name || '—'} · override:{' '}
      {resolved ? `${resolved.kind} (${resolved.record.status})` : 'none'}
    </div>
  )
}

function PersonDateOverrideNote({ personId, fact }: { personId: string; fact: string }) {
  const person = getFamilyDatabase().people.find((row) => row.id === personId)
  if (!person || (fact !== 'birth' && fact !== 'death')) return null
  const resolved = resolvePersonDateOverride(person, fact)
  const source = fact === 'death' ? person.dateSource?.deathDate ?? person.deathDate : person.dateSource?.birthDate ?? person.birthDate
  const effective = fact === 'death' ? person.deathDate : person.birthDate
  return (
    <div className="atlas-debug-muted">
      source: {source || '—'} · effective: {effective || '—'} · override:{' '}
      {resolved ? `${resolved.kind} (${resolved.record.status})` : 'none'}
    </div>
  )
}

function PlaceOverrideControls({
  original,
  onChanged,
}: {
  original: string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atlas = resolveAtlasPlace(original)
  const fingerprint = placeEntityKey(original)
  const cached = getCachedPlaceOverride(fingerprint)
  const automated = resolveCanonicalPlaceSync(original)

  const saveLocalOrRemote = async (input: Parameters<typeof cacheUpsert>[0]) => {
    setBusy(true)
    setError(null)
    try {
      try {
        await upsertOverrideRemote(input)
      } catch {
        cacheUpsert(input)
      }
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const revert = async () => {
    if (!cached) return
    setBusy(true)
    setError(null)
    try {
      try {
        await revertOverrideRemote(cached.id)
      } catch {
        cacheRevert(cached.id)
      }
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revert failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="atlas-debug-block atlas-debug-override-controls">
      <dl className="atlas-debug-dl">
        <dt>Override present?</dt>
        <dd>{cached ? `yes (${cached.overrideType}, ${cached.status})` : 'no'}</dd>
        <dt>Selection provenance</dt>
        <dd>{atlas.selectionProvenance ?? '—'}</dd>
        <dt>Final effective</dt>
        <dd>
          {atlas.label} · {atlas.source} · {atlas.confidence}
          {atlas.coordinate.resolved
            ? ` · (${atlas.coordinate.x.toFixed(1)}, ${atlas.coordinate.y.toFixed(1)})`
            : ''}
        </dd>
        <dt>Automated</dt>
        <dd>
          {automated.label ?? automated.status} · {automated.method} · {automated.confidence}
          {automated.canonicalPlaceId ? ` · ${automated.canonicalPlaceId}` : ''}
        </dd>
      </dl>
      <div className="atlas-debug-actions">
        <button
          type="button"
          disabled={busy || !automated.canonicalPlaceId}
          onClick={() =>
            void saveLocalOrRemote({
              entityType: 'place',
              entityKey: fingerprint,
              overrideType: 'confirm_resolution',
              source: 'atlas-debug',
              sourceSignature: placeSourceSignature(original, automated.canonicalPlaceId),
              payload: {
                fingerprint,
                originalExamples: [original],
                canonicalPlaceId: automated.canonicalPlaceId!,
                label: automated.label ?? undefined,
                selectionProvenance: 'canonical_selection',
                autoCanonicalPlaceId: automated.canonicalPlaceId,
              },
            })
          }
        >
          Confirm resolution
        </button>
        <button
          type="button"
          disabled={busy || !cached}
          onClick={() => void revert()}
        >
          Revert place correction
        </button>
      </div>
      {error ? <p className="atlas-debug-danger">{error}</p> : null}
    </div>
  )
}

function PlaceRecordView({
  record,
  onChanged,
}: {
  record: PlaceResolutionRecord
  onChanged: () => void
}) {
  return (
    <div className="atlas-debug-block">
      <dl className="atlas-debug-dl">
        <dt>Original</dt>
        <dd>{record.original || '—'}</dd>
        <dt>Normalized</dt>
        <dd>{record.normalized || '—'}</dd>
        <dt>Unified (shadow)</dt>
        <dd>
          {record.unified.status === 'ambiguous'
            ? 'ambiguous'
            : record.unified.status === 'resolved' || record.unified.status === 'coarse'
              ? record.unified.label
              : record.unified.status}{' '}
          · {record.unified.method} · {record.unified.confidence} · {record.unified.precision}
        </dd>
        <dt>Human override</dt>
        <dd>
          {record.unified.humanOverride.kind === 'none'
            ? 'none'
            : `${record.unified.humanOverride.kind} · ${record.unified.humanOverride.overrideId}`}
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
        <dt>Documentary</dt>
        <dd>
          {record.documentary.resolved
            ? `${record.documentary.label} (${record.documentary.canonicalId})`
            : 'unresolved'}{' '}
          · {record.documentary.method} · {record.documentary.confidence}
        </dd>
        <dt>Comparison</dt>
        <dd
          className={
            record.comparison.category !== 'AGREEMENT' ? 'atlas-debug-warn' : undefined
          }
        >
          {record.comparison.category}
          {record.comparison.summary ? `: ${record.comparison.summary}` : ''}
        </dd>
      </dl>
      <PlaceOverrideControls original={record.original} onChanged={onChanged} />
    </div>
  )
}

function EventRecordView({
  record,
  onChanged,
}: {
  record: EventLifecycleRecord
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const effect = resolveAtlasEvent(
    {
      kind: record.kind as FamilyEvent['kind'],
      year: record.year,
      title: record.title,
      detail: record.placeRaw || '',
      person: { id: record.personId, name: record.personName },
      importance: record.importanceBase,
    },
    record.synthesis.kind,
  )

  const toggleSuppress = async (suppress: boolean) => {
    if (!onChanged) return
    setBusy(true)
    try {
      const eventLike: FamilyEvent = {
        kind: record.kind as FamilyEvent['kind'],
        year: record.year,
        title: record.title,
        detail: record.placeRaw || '',
        person: { id: record.personId, name: record.personName },
        importance: record.importanceBase,
      }
      const fp = eventFingerprint(eventLike, record.synthesis.kind)
      if (suppress) {
        const input = {
          entityType: 'event' as const,
          entityKey: eventEntityKey(eventLike),
          overrideType: 'suppress' as const,
          source: 'atlas-debug',
          sourceSignature: fp,
          payload: { reason: 'Suppressed from Atlas Debugger', eventFingerprint: fp },
        }
        try {
          await upsertOverrideRemote(input)
        } catch {
          cacheUpsert(input)
        }
      } else {
        const existing = effect.overrides.find((row) => row.overrideType === 'suppress')
        if (existing) {
          try {
            await revertOverrideRemote(existing.id)
          } catch {
            cacheRevert(existing.id)
          }
        }
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

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
        <dt>Override eligibility</dt>
        <dd>
          suppressed={effect.suppressed ? 'yes' : 'no'} · force_include=
          {effect.forceIncludeEligible ? 'yes (eligible only)' : 'no'} · confirmed_inferred=
          {effect.confirmedInferred ? 'yes' : 'no'}
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
        <dt>Final visibility</dt>
        <dd>{record.finallyVisible ? 'visible' : `hidden (${record.hiddenReason ?? '—'})`}</dd>
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
      {onChanged ? (
        <div className="atlas-debug-actions">
          <button
            type="button"
            disabled={busy || effect.suppressed}
            onClick={() => void toggleSuppress(true)}
          >
            Suppress event
          </button>
          <button
            type="button"
            disabled={busy || !effect.suppressed}
            onClick={() => void toggleSuppress(false)}
          >
            Restore event
          </button>
        </div>
      ) : null}
      {record.placeResolution ? (
        <>
          <h4 className="atlas-debug-subhead">Attached place resolution</h4>
          <PlaceRecordView record={record.placeResolution} onChanged={onChanged ?? (() => undefined)} />
        </>
      ) : null}
    </div>
  )
}

export function AtlasDebuggerPanel() {
  const { database: familyDatabase } = useFamilyData()
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
  const [healthMode, setHealthMode] = useState<HealthMode>('summary')
  const [placeRefresh, setPlaceRefresh] = useState(0)
  const [eventRefresh, setEventRefresh] = useState(0)

  useEffect(() => {
    void ensureOverrideCacheLoaded()
    void fetchOverrides({ status: 'active' }).catch(() => undefined)
  }, [])

  const health = useMemo(() => {
    if (!enabled || !healthRan) return null
    return runAtlasHealthCheck()
  }, [enabled, healthRan, placeRefresh, eventRefresh])

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
  }, [placeQuery, placeRefresh])

  const bumpPlace = () => setPlaceRefresh((n) => n + 1)
  const bumpEvent = () => setEventRefresh((n) => n + 1)

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
            <button
              type="button"
              className="atlas-debug-action"
              onClick={() => {
                setHealthRan(true)
                setHealthMode('summary')
              }}
            >
              Run Atlas Health Check
            </button>
            {health && healthMode === 'review' ? (
              <ReviewFindingsPanel
                report={health}
                onPersisted={() => {
                  bumpPlace()
                  bumpEvent()
                }}
                onOpenPlaceTab={(original) => {
                  setPlaceQuery(original)
                  setTab('place')
                }}
                onExit={() => setHealthMode('summary')}
              />
            ) : null}
            {health && healthMode === 'summary' ? (
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
                  <dt>Remaining for review</dt>
                  <dd className={buildReviewQueue(health).length ? 'atlas-debug-warn' : undefined}>
                    {buildReviewQueue(health).length} priority (conflict + gap, not yet confirmed/ignored)
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
                  <dt>Names / dates</dt>
                  <dd>
                    {health.namesDates.name} name · {health.namesDates.date} date ·{' '}
                    {health.namesDates.impossible} impossible · {health.namesDates.unusual} unusual ·{' '}
                    {health.namesDates.uncertain} uncertain · {health.namesDates.presentation}{' '}
                    presentation
                    {health.namesDates.customerCandidates
                      ? ` · ${health.namesDates.customerCandidates} possible future Review`
                      : ''}
                  </dd>
                </dl>
                {health.nameDateFindings.length ? (
                  <>
                    <h4 className="atlas-debug-subhead">Name & date findings (diagnostic only)</h4>
                    <ul className="atlas-debug-list">
                      {health.nameDateFindings.map((finding) => (
                        <li key={finding.id}>
                          <div>
                            {finding.personName}{' '}
                            <span className="atlas-debug-muted">{finding.sourcePersonId}</span>
                          </div>
                          <div
                            className={
                              finding.severity === 'impossible' ? 'atlas-debug-danger' : 'atlas-debug-muted'
                            }
                          >
                            {finding.severity} · {finding.domain} · {finding.code}
                            {finding.customerCandidate ? ' · Review candidate' : ''}
                          </div>
                          <div className="atlas-debug-muted">{finding.reason}</div>
                          <div className="atlas-debug-muted">
                            raw: {finding.rawValues.join(' | ')}
                            {finding.relatedPersonName
                              ? ` · related: ${finding.relatedPersonName} (${finding.relatedRaw ?? ''})`
                              : ''}
                          </div>
                          {finding.domain === 'date' ? (
                            <PersonDateOverrideNote personId={finding.personId} fact={finding.fact} />
                          ) : finding.domain === 'name' ? (
                            <PersonNameOverrideNote personId={finding.personId} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {buildReviewQueue(health).length ? (
                  <div className="atlas-debug-actions">
                    <button type="button" onClick={() => setHealthMode('review')}>
                      Review findings
                    </button>
                  </div>
                ) : null}
                {health.priorityPlaces.length ? (
                  <>
                    <h4 className="atlas-debug-subhead">Priority places (conflict + resolution gap)</h4>
                    <ul className="atlas-debug-list">
                      {buildReviewQueue(health).slice(0, 40).map((item) => (
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
                          <button
                            type="button"
                            className="atlas-debug-action"
                            onClick={() => {
                              const key = `place:${placeEntityKey(item.original)}:${item.category}`
                              const input = {
                                entityType: 'diagnostic' as const,
                                entityKey: key,
                                overrideType: 'disposition' as const,
                                source: 'atlas-debug',
                                reviewState: 'ignored' as const,
                                payload: {
                                  category: item.category,
                                  disposition: 'ignored' as const,
                                  originalRef: item.original,
                                },
                              }
                              void (async () => {
                                try {
                                  await upsertOverrideRemote(input)
                                  bumpPlace()
                                } catch (err) {
                                  window.alert(
                                    err instanceof Error
                                      ? `Save failed — finding left unresolved. ${err.message}`
                                      : 'Save failed — finding left unresolved.',
                                  )
                                }
                              })()
                            }}
                          >
                            Mark ignored
                          </button>
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
            {eventLifecycle ? (
              <EventRecordView
                record={eventLifecycle}
                onChanged={bumpEvent}
              />
            ) : null}
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
            {placeRecord ? (
              <PlaceRecordView record={placeRecord} onChanged={bumpPlace} />
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
