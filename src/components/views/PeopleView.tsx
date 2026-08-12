import { useEffect, useMemo, useRef, useState } from 'react'
import { familyDatabase } from '../../data'
import { useTimeline } from '../../context/TimelineContext'
import { useAppNavigation } from '../../context/AppNavigationContext'
import {
  branchOptions,
  centuryOptions,
  computeNotableLives,
  DEFAULT_PEOPLE_FILTERS,
  filterPeople,
  notableLivesIntro,
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
  const { viewOnTimeline, viewOnTree } = useAppNavigation()
  const exploreRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<PersonSortKey>('birthYear')
  const [branch, setBranch] = useState('')
  const [place, setPlace] = useState('')
  const [century, setCentury] = useState('')
  const [directAncestorsOnly, setDirectAncestorsOnly] = useState(false)
  const [notableLivesExplanationOpen, setNotableLivesExplanationOpen] = useState(false)

  useEffect(() => {
    if (!active) return
    exploreRef.current?.scrollTo({ top: 0 })
  }, [active])

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
  const notableLivesExplanation = useMemo(
    () => notableLivesIntro(notableLives),
    [notableLives],
  )

  return (
    <section id="people" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="explore people-explore" ref={exploreRef}>
        <div className="people-sticky-chrome">
          <div className="people-sticky-chrome-top" aria-hidden="true" />
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
        </div>

        <div className="people-explore-intro">
          <div className="eyebrow">Explore the archive</div>
          <h2>{familyDatabase.stats.people} lives, connected.</h2>
        </div>
        {notableLives.length > 0 && (
          <section className="notable-lives" aria-labelledby="notable-lives-heading">
            <div className="notable-lives-header">
              <div className="notable-lives-heading-block">
                <div className="eyebrow" id="notable-lives-heading">
                  Notable lives
                </div>
                <p className="notable-lives-lede">Highlights drawn from the archive</p>
                {notableLivesExplanation && (
                  <div
                    className={`notable-lives-disclosure${notableLivesExplanationOpen ? ' is-expanded' : ''}`}
                  >
                    <button
                      type="button"
                      className="notable-lives-disclosure-trigger"
                      aria-expanded={notableLivesExplanationOpen}
                      aria-controls="notable-lives-explanation-panel"
                      onClick={() => setNotableLivesExplanationOpen((open) => !open)}
                    >
                      Why are these people notable?
                    </button>
                    <div
                      id="notable-lives-explanation-panel"
                      className="notable-lives-disclosure-panel"
                      aria-hidden={!notableLivesExplanationOpen}
                    >
                      <div className="notable-lives-disclosure-inner">
                        <p className="notable-lives-explanation">{notableLivesExplanation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="notable-lives-grid" role="list">
              {notableLives.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="listitem"
                  className="notable-life-card"
                  onClick={() => openPerson(n.person.id)}
                >
                  <span className="notable-life-label">{n.label}</span>
                  <strong>{n.person.name}</strong>
                  <small>{n.detail}</small>
                </button>
              ))}
            </div>
          </section>
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
                onViewTree={viewOnTree}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
