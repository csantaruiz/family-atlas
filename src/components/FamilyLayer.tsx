import { useMemo } from 'react'
import { useTimeline } from '../context/TimelineContext'
import {
  assignEventLanes,
  buildBirthClusters,
  chooseFocus,
  groupFamilyEvents,
  peopleBudgetForMode,
  placeLabels,
} from '../utils/clustering'
import { movementSummary } from '../utils/placeUtils'
import { yearX, zoomMode } from '../utils/timelineMath'

type FamilyLayerProps = {
  start: number
  end: number
  width: number
  height: number
}

const SunriseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 18h16" />
    <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
    <path d="M12 3v4" />
    <path d="m4.2 8.2 2.8 2" />
    <path d="m19.8 8.2-2.8 2" />
  </svg>
)

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M12 3v18" />
    <path d="M7.5 8h9" />
  </svg>
)

export function FamilyLayer({ start, end, width, height }: FamilyLayerProps) {
  const {
    span,
    presentYear,
    birthPeople,
    familyEvents,
    animateView,
    openPerson,
    openFamilyEvent,
  } = useTimeline()

  const mode = zoomMode(span)
  const showClusters = span > 240

  const densityBars = useMemo(() => {
    if (span < 120) return []
    const bin = span > 350 ? 50 : 25
    const bars: { x: number; width: number; opacity: number; height: number }[] = []
    for (let y = Math.floor(start / bin) * bin; y <= end; y += bin) {
      const count = birthPeople.filter((p) => p.birthYear && p.birthYear >= y && p.birthYear < y + bin).length
      if (!count) continue
      const x = yearX(y + bin / 2, start, span, width)
      bars.push({
        x,
        width: Math.max(6, (bin / span) * width * 0.78),
        opacity: Math.min(0.92, 0.15 + count / 16),
        height: 22 + Math.min(52, count * 2.5),
      })
    }
    return bars
  }, [span, start, end, birthPeople, width])

  const birthClusters = useMemo(() => {
    if (!showClusters) return []
    return buildBirthClusters(birthPeople, start, end, span, width, height, presentYear)
  }, [showClusters, birthPeople, start, end, span, width, height, presentYear])

  const individualData = useMemo(() => {
    if (showClusters) return null
    const events = familyEvents.filter((e) => e.year >= start && e.year <= end)
    const groups = groupFamilyEvents(events, start, span, width, mode)
    const placed = assignEventLanes(groups, height)
    const occupied = placed.map((p) => p.x)

    const visible = chooseFocus(
      birthPeople.filter((p) => p.birthYear && p.birthYear >= start && p.birthYear <= end),
      peopleBudgetForMode(mode),
    )
    const nodes = placeLabels(visible, start, span, width, height)
      .filter((o) => occupied.every((x) => Math.abs(x - o.x) > 120))
      .slice(0, peopleBudgetForMode(mode))

    return { placed, nodes }
  }, [showClusters, familyEvents, start, end, span, width, height, mode, birthPeople])

  return (
    <>
      <div className="density-layer">
        {densityBars.map((bar, i) => (
          <div
            key={i}
            className="density"
            style={{
              left: bar.x,
              width: bar.width,
              opacity: bar.opacity,
              height: bar.height,
            }}
          />
        ))}
      </div>
      <div id="nodes">
        {showClusters
          ? birthClusters.map((cluster, i) => {
              const exemplar = chooseFocus(cluster.people, 1)[0]
              const bin = span > 430 ? 100 : span > 280 ? 50 : 25
              return (
                <button
                  key={`cluster-${cluster.y}-${i}`}
                  type="button"
                  className="cluster"
                  style={{ left: Math.round(cluster.x), top: Math.round(cluster.displayY) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    const naturalSpan = Math.max(18, bin * 1.4)
                    const targetSpan = Math.max(6, Math.min(naturalSpan, span * 0.58))
                    animateView((cluster.from + cluster.to) / 2, targetSpan, 520)
                  }}
                >
                  <span className="cluster-orb">{cluster.people.length}</span>
                  <b>
                    {cluster.from}–{cluster.to}
                  </b>
                  <small>{exemplar ? exemplar.name : 'family records'}</small>
                </button>
              )
            })
          : individualData?.placed.map(({ group, x, y }) => {
              if (group.events.length > 1) {
                const first = Math.min(...group.events.map((e) => e.year))
                const last = Math.max(...group.events.map((e) => e.year))
                return (
                  <button
                    key={`fcluster-${first}-${last}`}
                    type="button"
                    className="family-event-cluster"
                    style={{ left: Math.round(x), top: Math.round(y) }}
                    title={`${group.events.length} family events from ${first} to ${last}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      const targetCenter = (first + last) / 2
                      const naturalSpan = Math.max(7, (last - first) * 2.2 + 8)
                      const targetSpan = Math.max(6, Math.min(naturalSpan, span * 0.58))
                      animateView(targetCenter, targetSpan, 560)
                    }}
                  >
                    <span className="cluster-count">{group.events.length}</span>
                    <span className="cluster-label">family events</span>
                    <span className="cluster-range">{first === last ? first : `${first}–${last}`}</span>
                    <span className="cluster-stem" />
                  </button>
                )
              }

              const e = group.events[0]
              let label: React.ReactNode
              let title: string
              let sub = ''

              if (e.kind === 'birth') {
                label = (
                  <>
                    <SunriseIcon />
                    BIRTH OF
                  </>
                )
                title = e.person.name
              } else if (e.kind === 'death') {
                label = (
                  <>
                    <CrossIcon />
                    DEATH OF
                  </>
                )
                title = e.person.name
              } else if (e.kind === 'move') {
                label = 'MIGRATION'
                title = e.person.name
                sub = movementSummary(e)
              } else {
                label = 'FAMILY STORY'
                title = e.title
                sub = e.detail || e.person.name
              }

              return (
                <button
                  key={`${e.kind}-${e.year}-${e.person.id}`}
                  type="button"
                  className={`family-event ${e.kind}`}
                  style={{ left: Math.round(x), top: Math.round(y) }}
                  title={e.title}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (e.kind === 'move' || e.kind === 'service') openFamilyEvent(e)
                    else openPerson(e.person.id)
                  }}
                >
                  <span className="event-copy">
                    <em>{label}</em>
                    <b>{title}</b>
                    {sub ? <small>{sub}</small> : null}
                  </span>
                  <span className="event-anchor" />
                  <span className="event-stem" />
                </button>
              )
            })}

        {!showClusters &&
          individualData?.nodes
            .filter((n) => n.show)
            .map(({ person: p, x, y }) => (
              <button
                key={p.id}
                type="button"
                className="node representative"
                style={{ left: Math.round(x), top: Math.round(y) }}
                title={`${p.name} · ${p.birthYear}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  openPerson(p.id)
                }}
              >
                <span className="node-dot" />
                <span className="node-label">
                  <b>{p.name}</b>
                  <small>
                    {p.birthYear}
                    {p.birthPlace ? ` · ${p.birthPlace.split(',')[0]}` : ''}
                  </small>
                </span>
              </button>
            ))}
      </div>
    </>
  )
}
