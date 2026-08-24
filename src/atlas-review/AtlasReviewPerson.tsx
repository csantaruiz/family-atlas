import { useEffect } from 'react'
import { useFamilyData } from '../family-data/FamilyDataProvider'
import { findPersonByRef } from '../family-data/resolvePerson'
import { useTimeline } from '../context/TimelineContext'
import { usePersonPortraits } from '../hooks/usePersonPortraits'
import { initials } from '../utils/format'
import { ensurePersonPortraitLoaded } from '../utils/personPortraitStore'
import { resolvePersonPortrait } from '../utils/resolvePersonPortrait'
import { eventStoryLine } from './customerReviewCopy'
import type { CustomerReviewItem } from './selectCustomerReviews'

export function AtlasReviewPerson({ item }: { item: CustomerReviewItem }) {
  const { database: familyDatabase } = useFamilyData()
  const { openPerson } = useTimeline()
  const uploaded = usePersonPortraits()
  const person = item.personId ? findPersonByRef(familyDatabase.people, item.personId) : null

  useEffect(() => {
    if (item.personId) void ensurePersonPortraitLoaded(item.personId)
  }, [item.personId])

  const name = person?.name ?? item.personName
  if (!name) {
    return <p className="atlas-review-person-fallback">A detail in your family history</p>
  }

  const portrait = person ? resolvePersonPortrait(person, uploaded[person.id]) : null
  const photo =
    portrait && !portrait.isUnavailablePlaceholder && portrait.image.src
      ? portrait.image.src
      : null

  const inner = (
    <>
      <span className="atlas-review-avatar" aria-hidden="true">
        {photo ? <img src={photo} alt="" /> : <span className="atlas-review-initials">{initials(name) || '?'}</span>}
      </span>
      <span className="atlas-review-person-text">
        <strong>{name}</strong>
        <span>{eventStoryLine(item)}</span>
      </span>
    </>
  )

  if (item.personId) {
    return (
      <button type="button" className="atlas-review-person" onClick={() => openPerson(item.personId!)}>
        {inner}
      </button>
    )
  }

  return <div className="atlas-review-person atlas-review-person--static">{inner}</div>
}
