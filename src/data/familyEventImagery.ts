import type { FamilyEvent, PersonImage } from '../types'

const MIGRATION_CALIFORNIA: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/An_olive_grove%2C_Los_Angeles%2C_ca.1900_%28CHS-5356%29.jpg/960px-An_olive_grove%2C_Los_Angeles%2C_ca.1900_%28CHS-5356%29.jpg',
  alt: 'Olive grove near Los Angeles, circa 1900',
  caption: 'Arrival in California',
  credit: 'California Historical Society / Wikimedia Commons (public domain).',
}

const MIGRATION_MEXICO: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Yuccaland--Chihuahua%2C_Mexico_SAAM-1970.290_1.jpg/960px-Yuccaland--Chihuahua%2C_Mexico_SAAM-1970.290_1.jpg',
  alt: 'Yucca landscape in Chihuahua',
  caption: 'Northern Mexico',
  credit: 'Smithsonian American Art Museum / Wikimedia Commons (public domain).',
}

const SOUTHWEST_US: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/El_Paso_Downtown_1908.jpg/720px-El_Paso_Downtown_1908.jpg',
  alt: 'Downtown El Paso, Texas, 1908',
  caption: 'El Paso, Texas',
  credit: 'El Paso Public Library / Wikimedia Commons (public domain).',
}

const MIGRATION_DEFAULT: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Lange-MigrantMother02.jpg/960px-Lange-MigrantMother02.jpg',
  alt: 'Migrant family during the Great Depression',
  caption: 'A family in transit',
  credit: 'Dorothea Lange / U.S. Farm Security Administration / Wikimedia Commons (public domain).',
}

const MIGRATION_ENGLAND: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Clement_Reid_-_Submerged_forest.jpg/960px-Clement_Reid_-_Submerged_forest.jpg',
  alt: 'Cheshire coast illustration, 1913',
  caption: 'The English shore',
  credit: 'Clement Reid / Wikimedia Commons (public domain).',
}

const SERVICE_MILITARY: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/NormandySupply_edit.jpg/960px-NormandySupply_edit.jpg',
  alt: 'Allied supply operations after the Normandy landings',
  caption: 'Wartime service',
  credit: 'U.S. Army / Wikimedia Commons (public domain).',
}

const SERVICE_INDUSTRY: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/%22Steel_for_Victory%22_-_NARA_-_534929.jpg/960px-%22Steel_for_Victory%22_-_NARA_-_534929.jpg',
  alt: 'Steelworkers at the Homestead Steel Works',
  caption: 'Industrial work',
  credit: 'U.S. National Archives / Wikimedia Commons (public domain).',
}

const SERVICE_ARCHIVE: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/LOC_Main_Reading_Room_Highsmith.jpg/960px-LOC_Main_Reading_Room_Highsmith.jpg',
  alt: 'Main Reading Room of the Library of Congress',
  caption: 'Keeping the record',
  credit: 'Carol M. Highsmith / Library of Congress / Wikimedia Commons (public domain).',
}

const MARRIAGE_MEXICO: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Nebel_Voyage_11_Hacendero.jpg/960px-Nebel_Voyage_11_Hacendero.jpg',
  alt: 'Mexican hacienda scene, 1836 lithograph',
  caption: 'A household is formed',
  credit: 'Carl Nebel / Wikimedia Commons (public domain).',
}

const MARRIAGE_ENGLAND: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Van_Eyck_-_Arnolfini_Portrait.jpg/960px-Van_Eyck_-_Arnolfini_Portrait.jpg',
  alt: 'The Arnolfini Portrait, a 15th-century marriage painting',
  caption: 'Marriage',
  credit: 'Jan van Eyck / National Gallery, London / Wikimedia Commons (public domain).',
}

const MARRIAGE_DEFAULT: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Pieter_Bruegel_the_Elder_-_Peasant_Wedding_-_Google_Art_Project.jpg/960px-Pieter_Bruegel_the_Elder_-_Peasant_Wedding_-_Google_Art_Project.jpg',
  alt: 'Peasant Wedding by Pieter Bruegel the Elder',
  caption: 'A wedding feast',
  credit: 'Pieter Bruegel the Elder / Wikimedia Commons (public domain).',
}

function eventHaystack(event: FamilyEvent): string {
  return [
    event.title,
    event.detail,
    event.person.name,
    event.person.birthPlace,
    event.person.deathPlace,
    event.spouse?.name,
    event.spouse?.birthPlace,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Public-domain / free art for non-birth family events (detail panel hero). */
export function getFamilyEventHeroImage(event: FamilyEvent): PersonImage | null {
  const text = eventHaystack(event)

  if (event.kind === 'marriage') {
    if (/mexico|chihuahua|aldama|carretas|méxico/.test(text)) return MARRIAGE_MEXICO
    if (/england|cheshire|astbury|gawsworth|prestbury/.test(text)) return MARRIAGE_ENGLAND
    return MARRIAGE_DEFAULT
  }

  if (event.kind === 'move') {
    if (/california|los angeles|anaheim|san diego/.test(text)) return MIGRATION_CALIFORNIA
    if (/mexico|chihuahua|aldama|méxico/.test(text)) return MIGRATION_MEXICO
    if (/england|cheshire|atlantic/.test(text)) return MIGRATION_ENGLAND
    return MIGRATION_DEFAULT
  }

  if (event.kind === 'service') {
    if (/war|bomb|serve|military|wartime|388th|air war/.test(text)) return SERVICE_MILITARY
    if (/ironwork|rigging|construction|industrial|steel|occupation/.test(text)) return SERVICE_INDUSTRY
    if (/archive|research|preservation|design/.test(text)) return SERVICE_ARCHIVE
    return SERVICE_ARCHIVE
  }

  return null
}

const BIRTH_DEFAULT: PersonImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/LOC_Main_Reading_Room_Highsmith.jpg/960px-LOC_Main_Reading_Room_Highsmith.jpg',
  alt: 'Archival reading room',
  caption: 'A life enters the record',
  credit: 'Carol M. Highsmith / Library of Congress / Wikimedia Commons (public domain).',
}

/** Public-domain stock when a journey beat has no authentic family photograph. */
export function getJourneyStockImage(type: string, locationText = ''): PersonImage {
  const text = `${type} ${locationText}`.toLowerCase()

  if (type === 'service' || /war|bomb|military|388th|air war/.test(text)) {
    if (/war|bomb|military|388th|air war|england|europe/.test(text)) return SERVICE_MILITARY
    if (/ironwork|rigging|steel|industrial/.test(text)) return SERVICE_INDUSTRY
    return SERVICE_ARCHIVE
  }

  if (type === 'marriage' || /wedding|married/.test(text)) {
    if (/mexico|chihuahua/.test(text)) return MARRIAGE_MEXICO
    if (/england|cheshire|scotland/.test(text)) return MARRIAGE_ENGLAND
    return MARRIAGE_DEFAULT
  }

  if (/california|los angeles|monrovia|anaheim/.test(text)) return MIGRATION_CALIFORNIA
  if (/\bel paso\b|\btexas\b|southwest/.test(text)) return SOUTHWEST_US
  if (/mexico|chihuahua/.test(text)) return MIGRATION_MEXICO
  if (/england|cheshire|scotland|britain/.test(text)) return MIGRATION_ENGLAND
  if (/new jersey|camden|industrial/.test(text)) return SERVICE_INDUSTRY
  if (type === 'move' || type === 'youth') return MIGRATION_DEFAULT
  if (type === 'death' || type === 'epilogue') {
    if (/california/.test(text)) return MIGRATION_CALIFORNIA
    return SERVICE_ARCHIVE
  }
  if (type === 'birth') {
    if (/california/.test(text)) return MIGRATION_CALIFORNIA
    if (/\bel paso\b|\btexas\b/.test(text)) return SOUTHWEST_US
    if (/mexico|chihuahua/.test(text)) return MIGRATION_MEXICO
    if (/england|scotland/.test(text)) return MIGRATION_ENGLAND
    return BIRTH_DEFAULT
  }

  return MIGRATION_DEFAULT
}
