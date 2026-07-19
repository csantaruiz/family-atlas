import type { FamilyEvent, Person } from '../../types'
import { initials } from '../../utils/format'
import {
  eventSummaryForPerson,
  lifespanYears,
  primaryLocations,
  relationshipToCraig,
  surnameOf,
} from '../../utils/personDirectory'

type PersonCardProps = {
  person: Person
  events: FamilyEvent[]
  onSelect: (id: string) => void
  onViewTimeline: (id: string) => void
  onViewTree: (id: string) => void
}

export function PersonCard({
  person,
  events,
  onSelect,
  onViewTimeline,
  onViewTree,
}: PersonCardProps) {
  const life =
    person.birthYear != null
      ? `${person.birthDate || person.birthYear}${person.deathYear ? ` — ${person.deathDate || person.deathYear}` : ''}`
      : 'Dates not recorded'

  const locations = primaryLocations(person)
  const relation = relationshipToCraig(person)
  const span = lifespanYears(person)

  return (
    <article className="person-card card">
      <button type="button" className="person-card-main" onClick={() => onSelect(person.id)}>
        <div className="person-card-portrait" aria-hidden="true">
          {initials(person.name)}
        </div>
        <div className="year">{person.birthYear ?? 'DATE UNKNOWN'}</div>
        <h3>{person.name}</h3>
        <p className="person-card-life">
          {life}
          {span != null ? ` · ${span} years` : ''}
        </p>
        {locations.length > 0 && (
          <p className="person-card-place">{locations.slice(0, 2).join(' · ')}</p>
        )}
        <div className="person-card-meta">
          <span className="person-card-branch">{surnameOf(person.name)}</span>
          {relation && <span className="person-card-relation">{relation}</span>}
          {person.generation != null && <span className="person-card-gen">Gen {person.generation}</span>}
        </div>
        <p className="person-card-summary">{eventSummaryForPerson(person, events)}</p>
      </button>
      <div className="person-card-actions">
        <button
          type="button"
          className="person-card-action pill"
          onClick={(e) => {
            e.stopPropagation()
            onViewTimeline(person.id)
          }}
        >
          View on timeline
        </button>
        <button
          type="button"
          className="person-card-action pill"
          onClick={(e) => {
            e.stopPropagation()
            onViewTree(person.id)
          }}
        >
          View in tree
        </button>
      </div>
    </article>
  )
}
