type FixturePerson = {
  id: string
  name: string
  sex?: string
  given?: string
  surname?: string
  suffix?: string
  aliases?: string[]
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  residences?: string[]
  famc?: string[]
  fams?: string[]
}

type FixtureFamily = {
  id: string
  husbandId?: string
  wifeId?: string
  children?: string[]
  marriageDate?: string
  marriagePlace?: string
}

function gedcomName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return `/${parts[0]}/`
  const surname = parts.pop()
  return `${parts.join(' ')} /${surname}/`
}

export function buildGedcom(people: FixturePerson[], families: FixtureFamily[] = []): string {
  const lines = ['0 HEAD', '1 CHAR UTF-8', '1 GEDC', '2 VERS 5.5.1']
  for (const person of people) {
    lines.push(`0 @${person.id}@ INDI`)
    lines.push(`1 NAME ${gedcomName(person.name)}`)
    if (person.given) lines.push(`2 GIVN ${person.given}`)
    if (person.surname) lines.push(`2 SURN ${person.surname}`)
    if (person.suffix) lines.push(`2 NSFX ${person.suffix}`)
    for (const alias of person.aliases ?? []) {
      lines.push(`1 NAME ${gedcomName(alias)}`)
    }
    if (person.sex) lines.push(`1 SEX ${person.sex}`)
    for (const famc of person.famc ?? []) lines.push(`1 FAMC @${famc}@`)
    for (const fams of person.fams ?? []) lines.push(`1 FAMS @${fams}@`)
    if (person.birthDate || person.birthPlace) {
      lines.push('1 BIRT')
      if (person.birthDate) lines.push(`2 DATE ${person.birthDate}`)
      if (person.birthPlace) lines.push(`2 PLAC ${person.birthPlace}`)
    }
    if (person.deathDate || person.deathPlace) {
      lines.push('1 DEAT')
      if (person.deathDate) lines.push(`2 DATE ${person.deathDate}`)
      if (person.deathPlace) lines.push(`2 PLAC ${person.deathPlace}`)
    }
    for (const place of person.residences ?? []) {
      lines.push('1 RESI')
      lines.push(`2 PLAC ${place}`)
    }
  }
  for (const family of families) {
    lines.push(`0 @${family.id}@ FAM`)
    if (family.husbandId) lines.push(`1 HUSB @${family.husbandId}@`)
    if (family.wifeId) lines.push(`1 WIFE @${family.wifeId}@`)
    for (const child of family.children ?? []) lines.push(`1 CHIL @${child}@`)
    if (family.marriageDate || family.marriagePlace) {
      lines.push('1 MARR')
      if (family.marriageDate) lines.push(`2 DATE ${family.marriageDate}`)
      if (family.marriagePlace) lines.push(`2 PLAC ${family.marriagePlace}`)
    }
  }
  lines.push('0 TRLR')
  return lines.join('\n')
}
