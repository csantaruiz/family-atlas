import { useMemo, useState } from 'react'
import { familyDatabase } from '../../data'
import { useTimeline } from '../../context/TimelineContext'
import { useAppNavigation } from '../../context/AppNavigationContext'
import {
  branchOptions,
  centuryOptions,
  computeNotableLives,
  DEFAULT_PEOPLE_FILTERS,
  filterPeople,
  placeFilterOptions,
  sortPeople,
  type PersonSortKey,
} from '../../utils/personDirectory'
import { PeopleFilters } from '../people/PeopleFilters'
import { PersonCard } from '../people/PersonCard'

type PeopleViewProps = {
  active: boolean
}

export function PeopleView({ active }: PeopleViewProps) {
  const { familyEvents, openPerson } = useTimeline()
  const { viewOnTimeline } = useAppNavigation()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<PersonSortKey>('birthYear')
  const [branch, setBranch] = useState('')
  const [place, setPlace] = useState('')
  const [century, setCentury] = useState('')
  const [directAncestorsOnly, setDirectAncestorsOnly] = useState(false)

  const people = familyDatabase.people
  const branches = useMemo(() => branchOptions(familyDatabase.stats.surnames), [])
  const places = useMemo(() => placeFilterOptions(familyDatabase.stats.places), [])
  const centuries = useMemo(() => centuryOptions(people), [people])

  const filtered = useMemo(
    () =>
      sortPeople(
        filterPeople(people, {
          ...DEFAULT_PEOPLE_FILTERS,
          query,
          branch,
          place,
          century,
          directAncestorsOnly,
        }),
        sortKey,
      ),
    [people, query, branch, place, century, directAncestorsOnly, sortKey],
  )

  const notableLives = useMemo(() => computeNotableLives(people, familyEvents), [people, familyEvents])

  return (
    <section id="people" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="explore">
        <div className="eyebrow">Explore the archive</div>
        <h2>{familyDatabase.stats.people} lives, connected.</h2>

        <input
          className="search"
          placeholder="Search a name, place, or year…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search people"
        />

        <PeopleFilters
          branches={branches}
          places={places}
          centuries={centuries}
          sortKey={sortKey}
          branch={branch}
          place={place}
          century={century}
          directAncestorsOnly={directAncestorsOnly}
          resultCount={filtered.length}
          onSortChange={setSortKey}
          onBranchChange={setBranch}
          onPlaceChange={setPlace}
          onCenturyChange={setCentury}
          onDirectAncestorsChange={setDirectAncestorsOnly}
        />

        {notableLives.length > 0 && (
          <div className="notable-lives">
            <div className="eyebrow">Notable lives</div>
            <div className="notable-lives-grid">
              {notableLives.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="notable-life-card"
                  onClick={() => openPerson(n.person.id)}
                >
                  <span className="notable-life-label">{n.label}</span>
                  <strong>{n.person.name}</strong>
                  <small>{n.detail}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No lives match these filters.</p>
            <p className="empty-state-hint">Try clearing a filter or broadening your search.</p>
          </div>
        ) : (
          <div className="grid people-grid">
            {filtered.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                events={familyEvents}
                onSelect={openPerson}
                onViewTimeline={viewOnTimeline}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
