export type PhoneTimelinePhase = 'desktop' | 'arrival' | 'exploring'

export function phoneTimelinePhase(phone: boolean, exploring: boolean): PhoneTimelinePhase {
  if (!phone) return 'desktop'
  return exploring ? 'exploring' : 'arrival'
}

export function phoneTimelineClassName(phase: PhoneTimelinePhase): string {
  if (phase === 'desktop') return ''
  return phase === 'exploring' ? 'timeline-phone timeline-phone--exploring' : 'timeline-phone timeline-phone--arrival'
}
