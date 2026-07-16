import type { PersonSortKey } from '../../utils/personDirectory'

type PeopleFiltersProps = {
  branches: string[]
  places: string[]
  centuries: { value: string; label: string }[]
  sortKey: PersonSortKey
  branch: string
  place: string
  century: string
  directAncestorsOnly: boolean
  resultCount: number
  onSortChange: (key: PersonSortKey) => void
  onBranchChange: (value: string) => void
  onPlaceChange: (value: string) => void
  onCenturyChange: (value: string) => void
  onDirectAncestorsChange: (value: boolean) => void
}

const SORT_OPTIONS: { value: PersonSortKey; label: string }[] = [
  { value: 'birthYear', label: 'Birth year' },
  { value: 'surname', label: 'Surname' },
  { value: 'lifespan', label: 'Lifespan' },
  { value: 'generation', label: 'Generation' },
]

export function PeopleFilters({
  branches,
  places,
  centuries,
  sortKey,
  branch,
  place,
  century,
  directAncestorsOnly,
  resultCount,
  onSortChange,
  onBranchChange,
  onPlaceChange,
  onCenturyChange,
  onDirectAncestorsChange,
}: PeopleFiltersProps) {
  return (
    <div className="people-filters">
      <div className="people-filters-row">
        <label className="filter-field">
          <span>Sort by</span>
          <select value={sortKey} onChange={(e) => onSortChange(e.target.value as PersonSortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Family branch</span>
          <select value={branch} onChange={(e) => onBranchChange(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Place</span>
          <select value={place} onChange={(e) => onPlaceChange(e.target.value)}>
            <option value="">All places</option>
            {places.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Century</span>
          <select value={century} onChange={(e) => onCenturyChange(e.target.value)}>
            <option value="">All centuries</option>
            {centuries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field filter-check">
          <input
            type="checkbox"
            checked={directAncestorsOnly}
            onChange={(e) => onDirectAncestorsChange(e.target.checked)}
          />
          <span>Direct ancestors only</span>
        </label>
      </div>
      <p className="people-result-count">
        {resultCount} {resultCount === 1 ? 'life' : 'lives'} in view
      </p>
    </div>
  )
}
