import { useEffect } from 'react'
import { eventContext } from '../data'
import { getHistoryEventHeroImage } from '../data/historyEventImagery'
import { getHistoryEventWikipediaUrl } from '../data/historyEventWikipedia'
import { useAppNavigation } from '../context/AppNavigationContext'
import { useTimeline } from '../context/TimelineContext'
import { usePersonPortraits } from '../hooks/usePersonPortraits'
import { initials } from '../utils/format'
import { eventSummaryForPerson, primaryLocations } from '../utils/personDirectory'
import { movementSummary, peopleRelevantToEvent } from '../utils/placeUtils'
import { ensurePersonPortraitLoaded } from '../utils/personPortraitStore'
import { resolvePersonPortrait } from '../utils/resolvePersonPortrait'
import { DetailPortrait } from './DetailPortrait'
import type { FamilyEvent, PersonImage } from '../types'

export function DetailPanel() {
  const { detail, peopleById, birthPeople, familyEvents, closeDetail, openPerson } = useTimeline()
  const { treeReturnViewport, returnToTimeline, activeView } = useAppNavigation()
  const uploadedPortraits = usePersonPortraits()

  const portraitPersonKey = detail?.type === 'person' ? detail.personId : null
  useEffect(() => {
    if (!portraitPersonKey) return
    void ensurePersonPortraitLoaded(portraitPersonKey)
  }, [portraitPersonKey])

  const isOpen = detail !== null

  let initialsText = ''
  let name = ''
  let gen = ''
  let life = ''
  let story = ''
  let facts: [string, string][] = []
  let relations: { kind: string; id: string; name: string }[] = []
  let sources: [string, string][] = []
  let isFamilyEvent = false
  let showHistoryRelated = false
  let historyRelated: ReturnType<typeof peopleRelevantToEvent> = []
  let isThinking = false
  let thinkingSections: {
    documentedFacts: string
    computedObservation: string
    historicalContext: string
    confidenceCaveats: string
  } | null = null
  let portraitImage: PersonImage | null = null
  let useArchivalPlaceholder = false
  let portraitVariant: 'portrait' | 'history-hero' = 'portrait'
  let historyWikipediaUrl: string | null = null
  let personEvents: FamilyEvent[] = []
  let showReturnToTimeline = false
  let portraitPersonId: string | undefined
  let portraitPersonName: string | undefined

  if (detail?.type === 'person') {
    const p = peopleById[detail.personId]
    if (p) {
      personEvents = familyEvents
        .filter((event) => event.person.id === p.id)
        .sort((a, b) => a.year - b.year)
      showReturnToTimeline = treeReturnViewport != null && activeView === 'tree'

      initialsText = initials(p.name)
      name = p.name
      gen =
        p.generation === 0
          ? 'The present generation'
          : p.generation != null
            ? `Generation ${p.generation} before Craig`
            : 'Extended family record'
      life = `${p.birthDate || p.birthYear || 'Birth unknown'} — ${p.deathDate || p.deathYear || 'Living'}`
      story =
        `${p.name} enters the documented family record ` +
        (p.birthYear ? `in ${p.birthYear}` : 'at an uncertain date') +
        (p.birthPlace ? `, in ${p.birthPlace}` : '') +
        '. '
      if (p.deathYear) {
        story += `The record closes in ${p.deathYear}${p.deathPlace ? ` at ${p.deathPlace}` : ''}. `
      } else if (p.deathDate) {
        story += `The record notes death on ${p.deathDate}. `
      }
      if (p.occupation?.length) {
        story += `Occupations recorded: ${p.occupation.join(', ')}. `
      }
      if (personEvents.length) {
        story += eventSummaryForPerson(p, familyEvents) + '. '
      }
      story +=
        'This Atlas preserves known dates, places, and relationships while leaving room for photographs, documents, and verified historical context.'
      facts = [
        ['Born', p.birthDate || (p.birthYear != null ? String(p.birthYear) : 'Not recorded')],
        ['Birthplace', p.birthPlace || 'Not recorded'],
        ['Died', p.deathDate || (p.deathYear != null ? String(p.deathYear) : 'Not recorded')],
        ['Death place', p.deathPlace || 'Not recorded'],
        ['Sex', p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : p.sex || 'Not recorded'],
        ['Places linked', primaryLocations(p).join(' · ') || 'Not recorded'],
        ['Occupation', p.occupation?.length ? p.occupation.join(', ') : 'Not recorded'],
        ['Timeline events', personEvents.length ? String(personEvents.length) : 'None indexed'],
      ]
      relations = [
        ...(p.parents ?? []).map((id) => ({ kind: 'Parent', id, name: peopleById[id]?.name ?? '' })),
        ...(p.spouses ?? []).map((id) => ({ kind: 'Spouse', id, name: peopleById[id]?.name ?? '' })),
        ...(p.children ?? []).map((id) => ({ kind: 'Child', id, name: peopleById[id]?.name ?? '' })),
      ].filter((r) => r.name)
      const resolved = resolvePersonPortrait(p, uploadedPortraits[p.id])
      portraitImage = resolved.image
      useArchivalPlaceholder = resolved.isUnavailablePlaceholder
      portraitPersonId = p.id
      portraitPersonName = p.name
    }
  } else if (detail?.type === 'familyEvent') {
    isFamilyEvent = true
    const e = detail.event
    const p = e.person
    const ctx = eventContext[e.title]
    initialsText = initials(p.name)
    name = e.title
    gen =
      e.kind === 'move'
        ? 'Migration and place'
        : e.kind === 'service'
          ? 'Featured family story'
          : 'Family event'
    life = `${e.year || 'Date uncertain'} · ${p.name}`
    if (ctx) {
      story = `${ctx.narrative} ${ctx.context}`
      sources = ctx.sources
    } else if (e.kind === 'move') {
      story = `${p.name} appears in records connected to more than one place. The marker is positioned approximately because the GEDCOM identifies locations but does not necessarily record the exact date of the move. ${movementSummary(e)}.`
    } else {
      story = e.detail || 'This event is connected to the documented family record.'
    }
    facts = [
      ['Event year', String(e.year || 'Approximate')],
      ['Person', p.name],
      ['Event type', e.kind === 'move' ? 'Migration / movement' : 'Family story'],
      ['Record detail', e.detail || 'Not yet documented'],
    ]
  } else if (detail?.type === 'history') {
    const ev = detail.event
    historyRelated = peopleRelevantToEvent(ev, birthPeople)
      .sort((a, b) => (a.generation ?? 99) - (b.generation ?? 99))
      .slice(0, 12)
    showHistoryRelated = true
    initialsText = String(ev.year).slice(-2)
    name = ev.title
    gen = `Historical context · ${ev.country}`
    life = String(ev.year)
    story = ev.summary
    facts = [
      ['Region', ev.country],
      [
        'Family records alive',
        `${historyRelated.length}${peopleRelevantToEvent(ev, birthPeople).length > historyRelated.length ? '+' : ''}`,
      ],
    ]
    relations = historyRelated.map((p) => ({
      kind: 'Alive then',
      id: p.id,
      name: p.name,
    }))
    portraitImage = getHistoryEventHeroImage(ev)
    portraitVariant = portraitImage ? 'history-hero' : 'portrait'
    historyWikipediaUrl = getHistoryEventWikipediaUrl(ev)
  } else if (detail?.type === 'thinking') {
    isThinking = true
    const thinking = detail.thinking
    initialsText = '✦'
    name = 'Atlas Thinking'
    gen = `${thinking.yearStart}–${thinking.yearEnd}`
    life = `Based on ${thinking.recordCount} records · ${thinking.confidence} confidence`
    story = ''
    thinkingSections = {
      documentedFacts: thinking.evidenceSummary,
      computedObservation: thinking.observation,
      historicalContext: `This observation draws on family records between ${thinking.yearStart} and ${thinking.yearEnd}. Related individuals may be opened from the timeline above.`,
      confidenceCaveats: `${thinking.confidence} confidence. This is a computed observation from uploaded family data — not output from a live AI service. Treat provisional patterns as research leads until linked to primary sources.`,
    }
    relations = thinking.relatedPersonIds
      .map((id) => ({ kind: 'Related', id, name: peopleById[id]?.name ?? '' }))
      .filter((r) => r.name)
  }

  return (
    <aside
      id="drawer"
      className={`drawer ${isOpen ? 'open' : ''}`}
      aria-label="Detail panel"
      aria-hidden={!isOpen}
    >
      <button type="button" id="drawerClose" className="drawer-close" aria-label="Close panel" onClick={closeDetail}>
        ×
      </button>
      <div className="drawer-content">
      {isOpen && (
        <>
          <DetailPortrait
            image={portraitImage}
            initials={initialsText}
            useArchivalPlaceholder={useArchivalPlaceholder}
            variant={portraitVariant}
            personId={portraitPersonId}
            personName={portraitPersonName}
          />
          <div className="person-body">
            <div className="eyebrow" id="personGen">
              {gen}
            </div>
            <h2 id="personName">{name}</h2>
            <div className="life" id="personLife">
              {life}
            </div>
            {!isThinking && (
              <>
                <p className="story" id="personStory">
                  {story}
                </p>
                {detail?.type === 'history' && historyWikipediaUrl ? (
                  <a
                    className="history-wikipedia-link"
                    href={historyWikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read on Wikipedia ↗
                  </a>
                ) : null}
              </>
            )}
            {isThinking && thinkingSections ? (
              <div className="thinking-detail-sections">
                <section className="thinking-detail-block">
                  <div className="eyebrow thinking-detail-eyebrow">Documented facts</div>
                  <p>{thinkingSections.documentedFacts}</p>
                </section>
                <section className="thinking-detail-block">
                  <div className="eyebrow thinking-detail-eyebrow">Computed observation</div>
                  <p>{thinkingSections.computedObservation}</p>
                </section>
                <section className="thinking-detail-block">
                  <div className="eyebrow thinking-detail-eyebrow">Historical context</div>
                  <p>{thinkingSections.historicalContext}</p>
                </section>
                <section className="thinking-detail-block">
                  <div className="eyebrow thinking-detail-eyebrow">Confidence and caveats</div>
                  <p>{thinkingSections.confidenceCaveats}</p>
                </section>
              </div>
            ) : (
              <div className="facts" id="facts">
                {facts.map(([label, value]) => (
                  <div key={label} className="fact">
                    <label>{label}</label>
                    <div>{value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="rel">
              <div className="eyebrow">Family connections</div>
              {isFamilyEvent ? (
                <div id="relations" style={{ marginTop: 12 }}>
                  {sources.length > 0 && (
                    <div className="event-source-list">
                      <h3>Historical context sources</h3>
                      {sources.map(([label, url]) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          {label} ↗
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="event-note">
                    Family-specific claims should be treated as provisional until linked to a census, city
                    directory, military file, employment record, photograph, letter, or oral-history source.
                  </div>
                </div>
              ) : (
                <div className="chips" id="relations" style={{ marginTop: 12 }}>
                  {relations.length ? (
                    relations.map((r) => (
                      <button key={`${r.kind}-${r.id}`} type="button" className="chip" onClick={() => openPerson(r.id)}>
                        {r.kind} · {r.name}
                      </button>
                    ))
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>
                      {detail?.type === 'history'
                        ? 'No confidently located family record overlaps this event.'
                        : detail?.type === 'thinking'
                          ? 'No linked individuals surfaced for this observation.'
                          : 'No linked relatives in this record.'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {showHistoryRelated && historyRelated.length > 0 && (
              <div className="history-related">
                <div className="eyebrow">Family alive during this event</div>
              </div>
            )}
            {detail?.type === 'person' && personEvents.length > 0 && (
              <div className="detail-event-list">
                <div className="eyebrow">Timeline events</div>
                <ul>
                  {personEvents.map((event) => (
                    <li key={`${event.kind}-${event.year}-${event.title}`}>
                      <strong>{event.year}</strong> · {event.title}
                      {event.detail ? ` — ${event.detail}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {showReturnToTimeline && (
              <button type="button" className="detail-return-timeline" onClick={returnToTimeline}>
                Return to timeline →
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </aside>
  )
}
