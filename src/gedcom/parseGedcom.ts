/**
 * TypeScript port of scripts/import-gedcom.py.
 * Same record rules: INDI NAME/SEX/BIRT/DEAT/RESI/FAMC/FAMS and FAM HUSB/WIFE/CHIL/MARR.
 * Occupations are not imported (always empty in the live FamilyDatabase).
 */
import type { FamilyMarriage } from '../data/familyMarriages'
import type { PersonNameSource } from '../types'
import type { FamilyGraph, GedcomFamily, GedcomPerson } from './types'
import { parseGedcomDate } from './parseGedcomDate'

type GedcomRecord = {
  id: string | null
  tag: string
  lines: Array<[number, string]>
}

type ParsedIndividual = GedcomPerson & {
  famc: string[]
  fams: string[]
}

function emptyNameSource(): PersonNameSource {
  return { rawPrimary: '', given: null, surname: null, suffix: null, aliases: [] }
}

function readNameParts(
  lines: Array<[number, string]>,
  start: number,
): { given: string | null; surname: string | null; suffix: string | null; next: number } {
  let given: string | null = null
  let surname: string | null = null
  let suffix: string | null = null
  let i = start
  while (i < lines.length && lines[i][0] > 1) {
    const [level, rest] = lines[i]
    if (level === 2 && rest.startsWith('GIVN ')) given = rest.slice(5).trim() || null
    else if (level === 2 && rest.startsWith('SURN ')) surname = rest.slice(5).trim() || null
    else if (level === 2 && rest.startsWith('NSFX ')) suffix = rest.slice(5).trim() || null
    i += 1
  }
  return { given, surname, suffix, next: i }
}

const YEAR_RE = /\b(\d{3,4})\b/g

export function formatGedcomName(raw: string): string {
  return raw
    .trim()
    .replace(/\/([^/]*)\//g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[ ,]+|[ ,]+$/g, '')
}

export function extractGedcomYear(date: string): number | null {
  if (!date) return null
  const years: number[] = []
  YEAR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = YEAR_RE.exec(date))) {
    const year = Number(match[1])
    if (year >= 1000 && year <= 2100) years.push(year)
  }
  return years.length ? years[years.length - 1] : null
}

export function stripGedcomPointer(value: string): string {
  return value.trim().replace(/^@+/, '').replace(/@+$/, '')
}

function parseRecords(text: string): GedcomRecord[] {
  const records: GedcomRecord[] = []
  let current: GedcomRecord | null = null
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const match = raw.match(/^(\d+)\s+(.*)$/)
    if (!match) continue
    const level = Number(match[1])
    const rest = match[2]
    if (level === 0) {
      if (current) records.push(current)
      const parts = rest.split(/ (.+)/)
      let pointer: string | null = null
      let tag = parts[0]
      if (parts[0]?.startsWith('@') && parts[0].endsWith('@')) {
        pointer = parts[0].slice(1, -1)
        tag = parts[1] ?? ''
      }
      current = { id: pointer, tag, lines: [] }
    } else if (current) {
      current.lines.push([level, rest])
    }
  }
  if (current) records.push(current)
  return records
}

function eventFields(
  lines: Array<[number, string]>,
  start: number,
): { date: string; place: string; next: number } {
  let date = ''
  let place = ''
  let i = start + 1
  while (i < lines.length && lines[i][0] > 1) {
    const [level, rest] = lines[i]
    if (level === 2 && rest.startsWith('DATE ')) date = rest.slice(5).trim()
    else if (level === 2 && rest.startsWith('PLAC ')) place = rest.slice(5).trim()
    i += 1
  }
  return { date, place, next: i }
}

function parseIndividual(record: GedcomRecord): ParsedIndividual | null {
  if (!record.id) return null
  const person: ParsedIndividual = {
    id: record.id,
    name: '',
    sex: '',
    birthDate: '',
    birthYear: null,
    birthPlace: '',
    deathDate: '',
    deathYear: null,
    deathPlace: '',
    places: [],
    parents: [],
    spouses: [],
    children: [],
    nameSource: emptyNameSource(),
    famc: [],
    fams: [],
  }
  const places: string[] = []
  const lines = record.lines
  let i = 0
  while (i < lines.length) {
    const [level, rest] = lines[i]
    if (level !== 1) {
      i += 1
      continue
    }
    if (rest.startsWith('NAME ')) {
      const raw = rest.slice(5)
      const formatted = formatGedcomName(raw)
      const parts = readNameParts(lines, i + 1)
      const source = person.nameSource ?? emptyNameSource()
      if (person.name && formatted && formatted !== person.name && !source.aliases.includes(person.name)) {
        source.aliases.push(person.name)
      }
      if (formatted) person.name = formatted
      source.rawPrimary = raw
      if (parts.given) source.given = parts.given
      if (parts.surname) source.surname = parts.surname
      if (parts.suffix) source.suffix = parts.suffix
      person.nameSource = source
      i = parts.next
      continue
    }
    if (rest.startsWith('SEX ')) {
      person.sex = rest.slice(4).trim()
      i += 1
      continue
    }
    if (rest.startsWith('FAMC ')) {
      const pointer = stripGedcomPointer(rest.slice(5))
      if (pointer) person.famc.push(pointer)
      i += 1
      continue
    }
    if (rest.startsWith('FAMS ')) {
      const pointer = stripGedcomPointer(rest.slice(5))
      if (pointer) person.fams.push(pointer)
      i += 1
      continue
    }
    if (rest === 'BIRT' || rest.startsWith('BIRT ')) {
      const event = eventFields(lines, i)
      person.birthDate = event.date
      person.birthYear = extractGedcomYear(event.date)
      person.birthDateParsed = parseGedcomDate(event.date)
      person.birthPlace = event.place
      if (event.place) places.push(event.place)
      i = event.next
      continue
    }
    if (rest === 'DEAT' || rest.startsWith('DEAT ')) {
      const event = eventFields(lines, i)
      person.deathDate = event.date
      person.deathYear = extractGedcomYear(event.date)
      person.deathDateParsed = parseGedcomDate(event.date)
      person.deathPlace = event.place
      if (event.place) places.push(event.place)
      i = event.next
      continue
    }
    if (rest === 'RESI' || rest.startsWith('RESI ')) {
      const event = eventFields(lines, i)
      if (event.place) places.push(event.place)
      i = event.next
      continue
    }
    i += 1
  }
  const seen = new Set<string>()
  person.places = places.filter((place) => {
    if (!place || seen.has(place)) return false
    seen.add(place)
    return true
  })
  return person
}

function parseFamily(record: GedcomRecord): GedcomFamily | null {
  if (!record.id) return null
  const family: GedcomFamily = {
    id: record.id,
    husbandId: null,
    wifeId: null,
    children: [],
    marriageDate: '',
    marriagePlace: '',
    marriageYear: null,
  }
  const lines = record.lines
  let i = 0
  while (i < lines.length) {
    const [level, rest] = lines[i]
    if (level !== 1) {
      i += 1
      continue
    }
    if (rest.startsWith('HUSB ')) {
      family.husbandId = stripGedcomPointer(rest.slice(5)) || null
      i += 1
      continue
    }
    if (rest.startsWith('WIFE ')) {
      family.wifeId = stripGedcomPointer(rest.slice(5)) || null
      i += 1
      continue
    }
    if (rest.startsWith('CHIL ')) {
      const child = stripGedcomPointer(rest.slice(5))
      if (child) family.children.push(child)
      i += 1
      continue
    }
    if (rest === 'MARR' || rest.startsWith('MARR ')) {
      const event = eventFields(lines, i)
      family.marriageDate = event.date
      family.marriagePlace = event.place
      family.marriageYear = extractGedcomYear(event.date)
      i = event.next
      continue
    }
    i += 1
  }
  return family
}

function uniquePush(list: string[], id: string) {
  if (!list.includes(id)) list.push(id)
}

export function parseGedcom(text: string): FamilyGraph {
  const records = parseRecords(text)
  const parsedPeople = records
    .filter((record) => record.tag === 'INDI' && record.id)
    .map(parseIndividual)
    .filter((person): person is ParsedIndividual => person !== null)
  const families = records
    .filter((record) => record.tag === 'FAM' && record.id)
    .map(parseFamily)
    .filter((family): family is GedcomFamily => family !== null)

  const byId = new Map(parsedPeople.map((person) => [person.id, person]))
  const familiesById = new Map(families.map((family) => [family.id, family]))
  const parents = new Map<string, string[]>()
  const spouses = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  const listFor = (map: Map<string, string[]>, id: string) => {
    const existing = map.get(id)
    if (existing) return existing
    const created: string[] = []
    map.set(id, created)
    return created
  }

  for (const person of parsedPeople) {
    for (const famId of person.famc) {
      const family = familiesById.get(famId)
      if (!family) continue
      for (const parentId of [family.husbandId, family.wifeId]) {
        if (parentId && byId.has(parentId)) uniquePush(listFor(parents, person.id), parentId)
      }
    }
    for (const famId of person.fams) {
      const family = familiesById.get(famId)
      if (!family) continue
      let partner: string | null = null
      if (family.husbandId === person.id) partner = family.wifeId
      else if (family.wifeId === person.id) partner = family.husbandId
      if (partner && byId.has(partner)) uniquePush(listFor(spouses, person.id), partner)
      for (const childId of family.children) {
        if (byId.has(childId)) uniquePush(listFor(children, person.id), childId)
      }
    }
  }

  const people: GedcomPerson[] = parsedPeople.map((person) => ({
    id: person.id,
    name: person.name || person.id,
    sex: person.sex,
    birthDate: person.birthDate,
    birthYear: person.birthYear,
    birthPlace: person.birthPlace,
    deathDate: person.deathDate,
    deathYear: person.deathYear,
    deathPlace: person.deathPlace,
    places: person.places,
    parents: parents.get(person.id) ?? [],
    spouses: spouses.get(person.id) ?? [],
    children: children.get(person.id) ?? [],
    nameSource: person.nameSource,
    birthDateParsed: person.birthDateParsed,
    deathDateParsed: person.deathDateParsed,
  }))

  const marriages: FamilyMarriage[] = families
    .filter((family) => family.marriageYear != null && family.husbandId && family.wifeId)
    .map((family) => ({
      id: family.id,
      year: family.marriageYear as number,
      date: family.marriageDate,
      place: family.marriagePlace,
      husbandId: family.husbandId as string,
      wifeId: family.wifeId as string,
    }))

  return { people, families, marriages }
}
