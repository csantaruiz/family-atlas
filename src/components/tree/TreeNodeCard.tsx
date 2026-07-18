import type { Person } from '../../types'
import { initials } from '../../utils/format'
import { surnameOf } from '../../utils/personDirectory'

type TreeNodeCardProps = {
  person: Person
  isRoot?: boolean
  focused?: boolean
  onSelect: (id: string) => void
}

export function TreeNodeCard({ person, isRoot = false, focused = false, onSelect }: TreeNodeCardProps) {
  const years =
    person.birthYear != null
      ? `${person.birthYear}${person.deathYear ? `–${person.deathYear}` : ''}`
      : '—'

  return (
    <button
      type="button"
      className={`tree-node-card${isRoot ? ' is-root' : ''}${focused ? ' is-focused' : ''}`}
      data-person-id={person.id}
      onClick={() => onSelect(person.id)}
      aria-label={`${person.name}, ${years}`}
    >
      <span className="tree-node-portrait" aria-hidden="true">
        {initials(person.name)}
      </span>
      <span className="tree-node-name">{person.name}</span>
      <span className="tree-node-years">{years}</span>
      <span className="tree-node-branch">{surnameOf(person.name)}</span>
    </button>
  )
}
