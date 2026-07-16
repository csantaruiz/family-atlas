import { eventContext } from '../data'
import { useTimeline } from '../context/TimelineContext'
import { initials } from '../utils/format'
import { movementSummary, peopleRelevantToEvent } from '../utils/placeUtils'

export function DetailPanel() {
  const { detail, peopleById, birthPeople, closeDetail, openPerson } = useTimeline()

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

  if (detail?.type === 'person') {
    const p = peopleById[detail.personId]
    if (p) {
      initialsText = initials(p.name)
      name = p.name
      gen =
        p.generation === 0
          ? 'The present generation'
          : p.generation != null
            ? `Generation ${p.generation} before Craig`
            : 'Extended family record'
      life = `${p.birthDate || p.birthYear || 'Birth unknown'} — ${p.deathDate || p.deathYear || ''}`
      story =
        `${p.name} enters the documented family record ` +
        (p.birthYear ? `in ${p.birthYear}` : 'at an uncertain date') +
        (p.birthPlace ? `, in ${p.birthPlace}` : '') +
        '. '
      if (p.occupation?.length) {
        story += `The tree records ${p.occupation.join(', ')} as an occupation. `
      }
      story +=
        'This Atlas preserves the known dates and relationships while leaving room for photographs, documents, memories, and verified historical context.'
      facts = [
        ['Born', p.birthDate || 'Not recorded'],
        ['Birthplace', p.birthPlace || 'Not recorded'],
        ['Died', p.deathDate || 'Not recorded'],
        ['Death place', p.deathPlace || 'Not recorded'],
      ]
      relations = [
        ...(p.parents ?? []).map((id) => ({ kind: 'Parent', id, name: peopleById[id]?.name ?? '' })),
        ...(p.spouses ?? []).map((id) => ({ kind: 'Spouse', id, name: peopleById[id]?.name ?? '' })),
        ...(p.children ?? []).map((id) => ({ kind: 'Child', id, name: peopleById[id]?.name ?? '' })),
      ].filter((r) => r.name)
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
      {isOpen && (
        <>
          <div className="portrait">
            <div className="initials" id="initials">
              {initialsText}
            </div>
          </div>
          <div className="person-body">
            <div className="eyebrow" id="personGen">
              {gen}
            </div>
            <h2 id="personName">{name}</h2>
            <div className="life" id="personLife">
              {life}
            </div>
            <p className="story" id="personStory">
              {story}
            </p>
            <div className="facts" id="facts">
              {facts.map(([label, value]) => (
                <div key={label} className="fact">
                  <label>{label}</label>
                  <div>{value}</div>
                </div>
              ))}
            </div>
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
          </div>
        </>
      )}
    </aside>
  )
}
