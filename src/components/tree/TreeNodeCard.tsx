import type { Person } from '../../types'
import { initials } from '../../utils/format'
import { surnameOf } from '../../utils/personDirectory'

export type TreeNodeDensity = 'far' | 'medium' | 'near'

type TreeNodeCardProps = {
  person: Person
  isRoot?: boolean
  isHousehold?: boolean
  focused?: boolean
  density?: TreeNodeDensity
  dimmed?: boolean
  onSelect: (id: string) => void
}

export function TreeNodeCard({
  person,
  isRoot = false,
  isHousehold = false,
  focused = false,
  density = 'near',
  dimmed = false,
  onSelect,
}: TreeNodeCardProps) {
  const years =
    person.birthYear != null
      ? `${person.birthYear}${person.deathYear ? `–${person.deathYear}` : ''}`
      : '—'
  const shortName = person.name.split(' ')[0] ?? person.name

  return (
    <button
      type="button"
      className={`tree-node-card density-${density}${isRoot || isHousehold ? ' is-root' : ''}${isHousehold ? ' is-household' : ''}${focused ? ' is-focused' : ''}${dimmed ? ' is-dimmed' : ''}`}
      data-person-id={person.id}
      onClick={() => onSelect(person.id)}
      onDoubleClick={() => onSelect(person.id)}
      aria-label={`${person.name}, ${years}`}
    >
      <span className="tree-node-portrait" aria-hidden="true">
        {initials(person.name)}
      </span>
      {density === 'far' ? (
        <span className="tree-node-name">{shortName}</span>
      ) : (
        <>
          <span className="tree-node-name">{person.name}</span>
          <span className="tree-node-years">{years}</span>
          {density === 'near' ? (
            <span className="tree-node-branch">{surnameOf(person.name)}</span>
          ) : null}
        </>
      )}
    </button>
  )
}
