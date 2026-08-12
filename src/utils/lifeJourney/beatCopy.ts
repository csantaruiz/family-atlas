import type { JourneyEvidenceKind } from '../../types/lifeJourney'

export function firstGivenName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export function possessiveGiven(name: string): string {
  const given = firstGivenName(name)
  return given.endsWith('s') ? `${given}'` : `${given}'s`
}

export function followJourneyCtaLabel(name: string): string {
  return `Follow ${possessiveGiven(name)} Journey`
}

export function evidenceLabel(kind: JourneyEvidenceKind): string {
  if (kind === 'documented') return 'Documented'
  if (kind === 'historical-context') return 'Historical context'
  return 'Inferred from the record'
}

export function birthCaption(given: string, dateLabel: string, place: string | null): string {
  if (place) {
    return `${dateLabel}. The record places ${given}’s beginning in ${place}.`
  }
  return `${dateLabel}. A birth is recorded; the place is not.`
}

export function youthCaption(given: string, place: string | null): string {
  if (place) {
    return `The years that follow are quieter in ${given}’s archive. Until the next dated event, the documented place remains ${place}.`
  }
  return `The years that follow are quieter in ${given}’s archive. No later place is attached until the next dated event.`
}

export function inferredCrossingCaption(fromLabel: string, toLabel: string): string {
  return `The archive does not date this crossing. The record places a life in ${fromLabel}, and later in ${toLabel}.`
}

export function deathCaption(given: string, dateLabel: string, place: string | null): string {
  if (place) {
    return `${dateLabel}. ${given}’s life closes in ${place}.`
  }
  return `${dateLabel}. The place is not recorded.`
}

export function epilogueCaption(given: string, fromLabel: string | null, toLabel: string | null): string {
  if (fromLabel && toLabel && fromLabel !== toLabel) {
    return `A life on the record from ${fromLabel} to ${toLabel} — assembled from dated events, not from a stored biography.`
  }
  if (fromLabel) {
    return `${given}’s documented story is gathered here from the family archive, without adding what the record does not say.`
  }
  return `${given}’s documented story is gathered here from the family archive.`
}

export function serviceCaption(narrative: string | null, context: string | null): string {
  const lead = narrative || 'A service event is recorded.'
  const firstSentence = lead.split(/(?<=\.)\s/)[0] || lead
  if (context) {
    return `${firstSentence} The surrounding geography is historical context, not a claim about an exact posting until a service file is attached.`
  }
  return `${firstSentence} Treat the surrounding geography as historical context until a service file is attached.`
}
