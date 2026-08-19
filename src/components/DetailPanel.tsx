import { useEffect } from 'react'
import { eventContext } from '../data'
import { getFamilyEventHeroImage } from '../data/familyEventImagery'
import { getHistoryEventHeroImage } from '../data/historyEventImagery'
import { getHistoryEventWikipediaUrl } from '../data/historyEventWikipedia'
import { useAppNavigation } from '../context/AppNavigationContext'
import { useTimeline } from '../context/TimelineContext'
import { usePersonPortraits } from '../hooks/usePersonPortraits'
import {
  buildFamilyEventNarrative,
  buildHistoryNarrative,
  buildPersonNarrative,
} from '../utils/buildDetailNarrative'
import { initials } from '../utils/format'
import { formatAmericanDate } from '../utils/formatDate'
import { primaryLocations } from '../utils/personDirectory'
import { peopleRelevantToEvent } from '../utils/placeUtils'
import { ensurePersonPortraitLoaded } from '../utils/personPortraitStore'
import { resolvePersonPortrait } from '../utils/resolvePersonPortrait'
import { DetailPortrait } from './DetailPortrait'
import { PersonJourneyButton } from './PersonJourneyButton'
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
  let storyParagraphs: string[] = []
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
  let journeyPersonId: string | null = null

  if (detail?.type === 'person') {
    const p = peopleById[detail.personId]
    if (p) {
      personEvents = familyEvents
        .filter((event) => event.person.id === p.id || event.spouse?.id === p.id)
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
      const narrative = buildPersonNarrative(p, peopleById, familyEvents)
      life = narrative.life
      storyParagraphs = narrative.paragraphs
      facts = [
        ['Born', formatAmericanDate(p.birthDate || p.birthYear) || 'Not recorded'],
        ['Birthplace', p.birthPlace || 'Not recorded'],
        ['Died', formatAmericanDate(p.deathDate || p.deathYear) || 'Not recorded'],
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
      journeyPersonId = p.id
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
          : e.kind === 'marriage'
            ? 'Marriage'
            : 'Family event'
    const narrative = buildFamilyEventNarrative(e, peopleById, birthPeople)
    life = narrative.life
    storyParagraphs = narrative.paragraphs
    if (ctx) sources = ctx.sources
    if (e.kind === 'marriage') {
      relations = [
        { kind: 'Spouse', id: p.id, name: p.name },
        ...(e.spouse ? [{ kind: 'Spouse', id: e.spouse.id, name: e.spouse.name }] : []),
      ]
    }
    const eventTypeLabel =
      e.kind === 'move' ? 'Migration / movement' : e.kind === 'marriage' ? 'Marriage' : 'Family story'
    facts =
      e.kind === 'marriage'
        ? [
            ['Event year', String(e.year || 'Approximate')],
            ['Husband', p.name],
            ['Wife', e.spouse?.name || 'Not recorded'],
            ['Event type', eventTypeLabel],
            ['Record detail', e.detail || 'Not yet documented'],
          ]
        : [
            ['Event year', String(e.year || 'Approximate')],
            ['Person', p.name],
            ['Event type', eventTypeLabel],
            ['Record detail', e.detail || 'Not yet documented'],
          ]
    if (e.kind === 'birth' || e.kind === 'death') {
      const resolved = resolvePersonPortrait(p, uploadedPortraits[p.id])
      portraitImage = resolved.image
      useArchivalPlaceholder = resolved.isUnavailablePlaceholder
      portraitPersonId = p.id
      portraitPersonName = p.name
    } else {
      portraitImage = getFamilyEventHeroImage(e)
      portraitVariant = portraitImage ? 'history-hero' : 'portrait'
    }
    journeyPersonId = p.id
  } else if (detail?.type === 'history') {
    const ev = detail.event
    historyRelated = peopleRelevantToEvent(ev, birthPeople)
      .sort((a, b) => (a.generation ?? 99) - (b.generation ?? 99))
      .slice(0, 12)
    showHistoryRelated = true
    initialsText = String(ev.year).slice(-2)
    name = ev.title
    gen = `Historical context · ${ev.country}`
    const historyNarrative = buildHistoryNarrative(ev, birthPeople)
    life = historyNarrative.life
    storyParagraphs = historyNarrative.paragraphs
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
            {journeyPersonId ? <PersonJourneyButton personId={journeyPersonId} /> : null}
            {!isThinking && (
              <>
                {(storyParagraphs.length ? storyParagraphs : story ? [story] : []).map(
                  (paragraph, index) => (
                    <p
                      key={`${index}-${paragraph.slice(0, 24)}`}
                      className="story"
                      id={index === 0 ? 'personStory' : undefined}
                    >
                      {paragraph}
                    </p>
                  ),
                )}
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
                  {relations.length > 0 && (
                    <div className="chips" style={{ marginBottom: 14 }}>
                      {relations.map((r) => (
                        <button
                          key={`${r.kind}-${r.id}`}
                          type="button"
                          className="chip"
                          onClick={() => openPerson(r.id)}
                        >
                          {r.kind} · {r.name}
                        </button>
                      ))}
                    </div>
                  )}
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
