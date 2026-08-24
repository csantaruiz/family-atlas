import type { FamilyMarriage } from '../data/familyMarriages'
import type { Person, PersonNameSource } from '../types'
import { parseGedcomDate, dateRangesDisjoint, type ParsedGedcomDate } from '../gedcom/parseGedcomDate'
import { sourcePersonIdOf } from '../family-data/resolvePerson'

export type NameDateDomain = 'name' | 'date'
export type NameDateSeverity = 'impossible' | 'unusual' | 'uncertain' | 'presentation'
export type NameDateConfidence = 'high' | 'medium' | 'low'
export type NameDateFact = 'name' | 'birth' | 'death' | 'marriage'

export type NameDateFinding = {
  id: string
  domain: NameDateDomain
  code: string
  severity: NameDateSeverity
  confidence: NameDateConfidence
  /** Future Atlas Review candidate — 2E.1 records this but does not enqueue it. */
  customerCandidate: boolean
  personId: string
  sourcePersonId: string
  personName: string
  fact: NameDateFact
  rawValues: string[]
  interpreted: string
  relatedPersonId?: string
  relatedPersonName?: string
  relatedFact?: NameDateFact
  relatedRaw?: string
  reason: string
}

export type NameDateFindingCounts = {
  name: number
  date: number
  impossible: number
  unusual: number
  uncertain: number
  presentation: number
  customerCandidates: number
}

const GARBAGE = /[*#<>]|[?]{2,}|[\u0000-\u0008]/
const PLACEHOLDER = /^(unknown|n\/?a|nn|n\.n\.|unnamed|not known|living)$/i

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/["'().,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function isExpansion(a: string, b: string): boolean {
  const left = tokens(a)
  const right = tokens(b)
  if (!left.length || !right.length) return false
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left]
  return shorter.every((token) => longer.includes(token))
}

function nameSourceOf(person: Person): PersonNameSource | undefined {
  return person.nameSource
}

function parsedBirth(person: Person): ParsedGedcomDate {
  return parseGedcomDate(person.birthDate ?? '')
}

function parsedDeath(person: Person): ParsedGedcomDate {
  return parseGedcomDate(person.deathDate ?? '')
}

function byId(people: Person[]): Map<string, Person> {
  const map = new Map<string, Person>()
  for (const person of people) {
    map.set(person.id, person)
    if (person.sourcePersonId) map.set(person.sourcePersonId, person)
  }
  return map
}

function describeDate(parsed: ParsedGedcomDate): string {
  if (!parsed.raw) return '(none)'
  if (parsed.qualifier === 'range' && parsed.earliestYear != null && parsed.latestYear != null) {
    return `range ${parsed.earliestYear}–${parsed.latestYear}`
  }
  if (parsed.qualifier !== 'exact') return `${parsed.qualifier} ${parsed.raw}`
  return parsed.raw
}

function findingId(parts: string[]): string {
  return parts.map((part) => part.replace(/[^a-zA-Z0-9_-]/g, '_')).join(':')
}

function detectNames(people: Person[]): NameDateFinding[] {
  const findings: NameDateFinding[] = []
  for (const person of people) {
    const sourceId = sourcePersonIdOf(person)
    const display = person.name.trim()
    const source = nameSourceOf(person)
    const rawPrimary = source?.rawPrimary || display

    if (GARBAGE.test(display) || GARBAGE.test(rawPrimary)) {
      findings.push({
        id: findingId(['name', person.id, 'garbage']),
        domain: 'name',
        code: 'name_import_garbage',
        severity: 'impossible',
        confidence: 'high',
        customerCandidate: true,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'name',
        rawValues: [rawPrimary, display],
        interpreted: display.replace(/[*#<>]+/g, '').replace(/\s+/g, ' ').trim(),
        reason: 'The recorded name contains characters that are almost never part of a real personal name.',
      })
    }

    if (PLACEHOLDER.test(display) || (source?.given && PLACEHOLDER.test(source.given) && !source.surname)) {
      findings.push({
        id: findingId(['name', person.id, 'placeholder']),
        domain: 'name',
        code: 'name_placeholder',
        severity: 'presentation',
        confidence: 'medium',
        customerCandidate: false,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'name',
        rawValues: [display],
        interpreted: display,
        reason: 'The name is a placeholder rather than a recorded personal name.',
      })
    }

    const parts = display.split(/\s+/).filter(Boolean)
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (parts[i].toLowerCase() === parts[i + 1].toLowerCase() && /[a-zA-Z]{2,}/.test(parts[i])) {
        findings.push({
          id: findingId(['name', person.id, 'duplicate-token']),
          domain: 'name',
          code: 'name_duplicate_token',
          severity: 'unusual',
          confidence: 'medium',
          customerCandidate: false,
          personId: person.id,
          sourcePersonId: sourceId,
          personName: person.name,
          fact: 'name',
          rawValues: [display],
          interpreted: display,
          reason: 'The display name repeats the same word twice in a row.',
        })
        break
      }
    }

    const aliases = source?.aliases ?? []
    for (const alias of aliases) {
      if (!alias || alias === display) continue
      if (isExpansion(display, alias)) continue
      findings.push({
        id: findingId(['name', person.id, 'alias', alias]),
        domain: 'name',
        code: 'name_alias_conflict',
        severity: 'unusual',
        confidence: 'medium',
        customerCandidate: false,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'name',
        rawValues: [display, alias],
        interpreted: `${display} vs ${alias}`,
        reason: 'An additional NAME record is not a simple expansion of the primary name.',
      })
    }
  }
  return findings
}

function detectDates(people: Person[], marriages: FamilyMarriage[]): NameDateFinding[] {
  const findings: NameDateFinding[] = []
  const peopleById = byId(people)

  for (const person of people) {
    const sourceId = sourcePersonIdOf(person)
    const birth = parsedBirth(person)
    const death = parsedDeath(person)

    if (birth.malformed && (person.birthDate ?? '').trim()) {
      findings.push({
        id: findingId(['date', person.id, 'birth-malformed']),
        domain: 'date',
        code: 'date_malformed',
        severity: 'uncertain',
        confidence: 'medium',
        customerCandidate: false,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'birth',
        rawValues: [birth.raw],
        interpreted: describeDate(birth),
        reason: 'The birth DATE string could not be parsed as a genealogical date.',
      })
    }
    if (death.malformed && (person.deathDate ?? '').trim()) {
      findings.push({
        id: findingId(['date', person.id, 'death-malformed']),
        domain: 'date',
        code: 'date_malformed',
        severity: 'uncertain',
        confidence: 'medium',
        customerCandidate: false,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'death',
        rawValues: [death.raw],
        interpreted: describeDate(death),
        reason: 'The death DATE string could not be parsed as a genealogical date.',
      })
    }

    if (birth.raw && !birth.calendarValid) {
      findings.push({
        id: findingId(['date', person.id, 'birth-calendar']),
        domain: 'date',
        code: 'date_impossible_calendar',
        severity: 'impossible',
        confidence: 'high',
        customerCandidate: birth.year != null && birth.year >= 1700,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'birth',
        rawValues: [birth.raw],
        interpreted: describeDate(birth),
        reason: 'The birth date is not a valid calendar day.',
      })
    }
    if (death.raw && !death.calendarValid) {
      findings.push({
        id: findingId(['date', person.id, 'death-calendar']),
        domain: 'date',
        code: 'date_impossible_calendar',
        severity: 'impossible',
        confidence: 'high',
        customerCandidate: death.year != null && death.year >= 1700,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'death',
        rawValues: [death.raw],
        interpreted: describeDate(death),
        reason: 'The death date is not a valid calendar day.',
      })
    }

    if (birth.raw && death.raw && dateRangesDisjoint(death, birth)) {
      const reliable = birth.reliableForContradiction && death.reliableForContradiction
      findings.push({
        id: findingId(['date', person.id, 'death-before-birth']),
        domain: 'date',
        code: 'date_death_before_birth',
        severity: reliable ? 'impossible' : 'uncertain',
        confidence: reliable ? 'high' : 'low',
        customerCandidate: reliable,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'death',
        rawValues: [birth.raw, death.raw],
        interpreted: `birth ${describeDate(birth)}; death ${describeDate(death)}`,
        relatedPersonId: person.id,
        relatedPersonName: person.name,
        relatedFact: 'birth',
        relatedRaw: birth.raw,
        reason: reliable
          ? 'The recorded death is before the recorded birth.'
          : 'Death appears to precede birth, but one or both dates are too coarse to treat as a customer problem.',
      })
    }

    if (
      birth.earliestYear != null &&
      death.latestYear != null &&
      death.latestYear - birth.earliestYear >= 110
    ) {
      const span = death.latestYear - birth.earliestYear
      const reliable = birth.reliableForContradiction && death.reliableForContradiction
      findings.push({
        id: findingId(['date', person.id, 'lifespan']),
        domain: 'date',
        code: span >= 130 && reliable ? 'date_impossible_lifespan' : 'date_extreme_lifespan',
        severity: span >= 130 && reliable ? 'impossible' : 'unusual',
        confidence: reliable ? 'medium' : 'low',
        customerCandidate: false,
        personId: person.id,
        sourcePersonId: sourceId,
        personName: person.name,
        fact: 'death',
        rawValues: [birth.raw, death.raw],
        interpreted: `${span} years (${describeDate(birth)} – ${describeDate(death)})`,
        relatedFact: 'birth',
        relatedRaw: birth.raw,
        reason:
          span >= 130 && reliable
            ? 'The implied lifespan is beyond a plausible human life.'
            : 'The implied lifespan is unusually long; it may still be a coarse or copied date.',
      })
    }

    for (const parentId of person.parents ?? []) {
      const parent = peopleById.get(parentId)
      if (!parent) continue
      const parentBirth = parsedBirth(parent)
      const parentDeath = parsedDeath(parent)

      if (birth.raw && parentBirth.raw && dateRangesDisjoint(birth, parentBirth)) {
        const reliable = birth.reliableForContradiction && parentBirth.reliableForContradiction
        findings.push({
          id: findingId(['date', person.id, 'before-parent', parent.id]),
          domain: 'date',
          code: 'date_child_before_parent_birth',
          severity: reliable ? 'impossible' : 'uncertain',
          confidence: reliable ? 'high' : 'low',
          customerCandidate: reliable,
          personId: person.id,
          sourcePersonId: sourceId,
          personName: person.name,
          fact: 'birth',
          rawValues: [birth.raw, parentBirth.raw],
          interpreted: `${describeDate(birth)} vs parent born ${describeDate(parentBirth)}`,
          relatedPersonId: parent.id,
          relatedPersonName: parent.name,
          relatedFact: 'birth',
          relatedRaw: parentBirth.raw,
          reason: reliable
            ? 'This person is recorded as born before a parent’s birth.'
            : 'The child appears older than a parent, but the dates are too coarse (or too early) to ask the family.',
        })
      }

      if (birth.raw && parentDeath.raw && dateRangesDisjoint(parentDeath, birth)) {
        const gap =
          birth.earliestYear != null && parentDeath.latestYear != null
            ? birth.earliestYear - parentDeath.latestYear
            : 0
        const reliable =
          birth.reliableForContradiction && parentDeath.reliableForContradiction && gap >= 1
        findings.push({
          id: findingId(['date', person.id, 'after-parent-death', parent.id]),
          domain: 'date',
          code: 'date_child_after_parent_death',
          severity: reliable ? 'impossible' : 'uncertain',
          confidence: reliable ? 'high' : 'low',
          customerCandidate: reliable,
          personId: person.id,
          sourcePersonId: sourceId,
          personName: person.name,
          fact: 'birth',
          rawValues: [birth.raw, parentDeath.raw],
          interpreted: `${describeDate(birth)} vs parent died ${describeDate(parentDeath)}`,
          relatedPersonId: parent.id,
          relatedPersonName: parent.name,
          relatedFact: 'death',
          relatedRaw: parentDeath.raw,
          reason: reliable
            ? 'This person is recorded as born after a parent’s death.'
            : 'Birth appears after a parent’s death, but coarse or early dates make a missing generation more likely than a customer-fixable date.',
        })
      }

      if (birth.earliestYear != null && parentBirth.latestYear != null) {
        const minAge = birth.earliestYear - parentBirth.latestYear
        const maxAge = (birth.latestYear ?? birth.earliestYear) - (parentBirth.earliestYear ?? parentBirth.latestYear)
        if (minAge >= 0 && maxAge < 12) {
          findings.push({
            id: findingId(['date', person.id, 'young-parent', parent.id]),
            domain: 'date',
            code: 'date_young_parent',
            severity: 'unusual',
            confidence: birth.reliableForContradiction && parentBirth.reliableForContradiction ? 'medium' : 'low',
            customerCandidate: false,
            personId: person.id,
            sourcePersonId: sourceId,
            personName: person.name,
            fact: 'birth',
            rawValues: [birth.raw, parentBirth.raw],
            interpreted: `parent about ${maxAge} (${parent.name})`,
            relatedPersonId: parent.id,
            relatedPersonName: parent.name,
            relatedFact: 'birth',
            relatedRaw: parentBirth.raw,
            reason: 'The implied parental age is unusually young. That can be a record error, or a year-only date.',
          })
        }
        if (minAge > 70) {
          findings.push({
            id: findingId(['date', person.id, 'old-parent', parent.id]),
            domain: 'date',
            code: 'date_old_parent',
            severity: 'unusual',
            confidence: 'low',
            customerCandidate: false,
            personId: person.id,
            sourcePersonId: sourceId,
            personName: person.name,
            fact: 'birth',
            rawValues: [birth.raw, parentBirth.raw],
            interpreted: `parent at least ${minAge} (${parent.name})`,
            relatedPersonId: parent.id,
            relatedPersonName: parent.name,
            relatedFact: 'birth',
            relatedRaw: parentBirth.raw,
            reason: 'The implied parental age is unusually old. Possible for men; often a copied or coarse date.',
          })
        }
      }
    }
  }

  for (const marriage of marriages) {
    const partners = [marriage.husbandId, marriage.wifeId]
    const parsed = parseGedcomDate(marriage.date)
    for (const partnerId of partners) {
      const person = peopleById.get(partnerId)
      if (!person) continue
      const birth = parsedBirth(person)
      if (!birth.raw || !parsed.raw) continue
      if (!dateRangesDisjoint(parsed, birth)) continue
      const reliable = birth.reliableForContradiction && parsed.reliableForContradiction
      findings.push({
        id: findingId(['date', person.id, 'marriage-before-birth', marriage.id]),
        domain: 'date',
        code: 'date_marriage_before_birth',
        severity: reliable ? 'impossible' : 'uncertain',
        confidence: reliable ? 'high' : 'low',
        customerCandidate: reliable,
        personId: person.id,
        sourcePersonId: sourcePersonIdOf(person),
        personName: person.name,
        fact: 'marriage',
        rawValues: [birth.raw, parsed.raw],
        interpreted: `married ${describeDate(parsed)}; born ${describeDate(birth)}`,
        relatedFact: 'birth',
        relatedRaw: birth.raw,
        reason: reliable
          ? 'A marriage is recorded before this person’s birth.'
          : 'Marriage appears to precede birth, but the dates are too coarse to treat as a customer problem.',
      })
    }
  }

  return findings
}

export function summarizeNameDateFindings(findings: NameDateFinding[]): NameDateFindingCounts {
  const counts: NameDateFindingCounts = {
    name: 0,
    date: 0,
    impossible: 0,
    unusual: 0,
    uncertain: 0,
    presentation: 0,
    customerCandidates: 0,
  }
  for (const finding of findings) {
    if (finding.domain === 'name') counts.name += 1
    else counts.date += 1
    counts[finding.severity] += 1
    if (finding.customerCandidate) counts.customerCandidates += 1
  }
  return counts
}

export function collectNameDateFindings(input: {
  people: Person[]
  marriages: FamilyMarriage[]
}): NameDateFinding[] {
  const findings = [...detectNames(input.people), ...detectDates(input.people, input.marriages)]
  findings.sort((a, b) => {
    const rank = (severity: NameDateSeverity) =>
      severity === 'impossible' ? 0 : severity === 'unusual' ? 1 : severity === 'uncertain' ? 2 : 3
    return rank(a.severity) - rank(b.severity) || a.personName.localeCompare(b.personName)
  })
  return findings
}
