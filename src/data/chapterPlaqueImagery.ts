export type ChapterPlaqueBackground = {
  key: string
  src: string
  alt: string
  position?: string
  credit?: string
}

type ImageryRule = ChapterPlaqueBackground & {
  patterns: RegExp[]
  priority: number
}

/** Prefer lithographs, book plates, and period illustrations over modern photography. */
const PLAQUE_IMAGERY_RULES: ImageryRule[] = [
  {
    key: 'california-grove-1900',
    patterns: [
      /arrival in california/i,
      /california becomes home/i,
      /crossing into california/i,
      /\bcalifornia\b/i,
      /san diego|los angeles/i,
      /western branch of the family/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/An_olive_grove%2C_Los_Angeles%2C_ca.1900_%28CHS-5356%29.jpg/960px-An_olive_grove%2C_Los_Angeles%2C_ca.1900_%28CHS-5356%29.jpg',
    alt: 'Olive grove near Los Angeles, circa 1900 glass plate',
    position: 'center 54%',
    credit: 'California Historical Society / Wikimedia Commons (public domain).',
    priority: 100,
  },
  {
    key: 'chihuahua-yuccaland',
    patterns: [
      /colonial chihuahua/i,
      /expansion through chihuahua/i,
      /families take root in chihuahua/i,
      /\bchihuahua\b/i,
      /rosales|parral|santa isabel/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Yuccaland--Chihuahua%2C_Mexico_SAAM-1970.290_1.jpg/960px-Yuccaland--Chihuahua%2C_Mexico_SAAM-1970.290_1.jpg',
    alt: 'Yucca landscape in Chihuahua, vintage print',
    position: 'center 58%',
    credit: 'Smithsonian American Art Museum / Wikimedia Commons (public domain).',
    priority: 98,
  },
  {
    key: 'northern-mexico-nebel',
    patterns: [
      /migration into northern mexico/i,
      /northern new spain/i,
      /families take root in the north/i,
      /northern mexico/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Nebel_Voyage_11_Hacendero.jpg/960px-Nebel_Voyage_11_Hacendero.jpg',
    alt: 'Mexican hacienda scene, 1836 lithograph',
    position: 'center 46%',
    credit: 'Carl Nebel / Wikimedia Commons (public domain).',
    priority: 96,
  },
  {
    key: 'mexican-independence',
    patterns: [
      /before independence/i,
      /living through independence/i,
      /mexican independence/i,
      /revolutions reshape north america/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Nebel_Voyage_05_Pyramid_of_Papantla.jpg/960px-Nebel_Voyage_05_Pyramid_of_Papantla.jpg',
    alt: 'Mexican landscape, 1836 lithograph',
    position: 'center 48%',
    credit: 'Carl Nebel / Wikimedia Commons (public domain).',
    priority: 94,
  },
  {
    key: 'industrial-america',
    patterns: [
      /industrial america/i,
      /ironworker/i,
      /pennsylvania|new jersey|camden|essex|morris/i,
      /ironwork|industrial-age/i,
      /building the ironworker family/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/%22Steel_for_Victory%22_-_NARA_-_534929.jpg/960px-%22Steel_for_Victory%22_-_NARA_-_534929.jpg',
    alt: 'Steelworkers at the Homestead Steel Works',
    position: 'center 48%',
    credit: 'U.S. National Archives / Wikimedia Commons (public domain).',
    priority: 92,
  },
  {
    key: 'atlantic-crossing',
    patterns: [
      /crossing the atlantic/i,
      /arrival in america/i,
      /english branch/i,
      /early branches take shape/i,
      /\bengland\b|cheshire|gawsworth|lancashire/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Clement_Reid_-_Submerged_forest.jpg/960px-Clement_Reid_-_Submerged_forest.jpg',
    alt: 'Cheshire coast, 1913 book illustration',
    position: 'center 52%',
    credit: 'Clement Reid / Wikimedia Commons (public domain).',
    priority: 90,
  },
  {
    key: 'wartime-service',
    patterns: [
      /world war generation/i,
      /wartime generation/i,
      /service and wartime/i,
      /called to serve/i,
      /wartime service/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Over_the_Top_Art.IWMART16975.jpg/960px-Over_the_Top_Art.IWMART16975.jpg',
    alt: 'Soldiers going over the top during the First World War',
    position: 'center 42%',
    credit: 'Ernest Brooks / Imperial War Museums / Wikimedia Commons (public domain).',
    priority: 88,
  },
  {
    key: 'postwar-family',
    patterns: [
      /postwar expansion/i,
      /postwar generations/i,
      /the living family/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Lange-MigrantMother02.jpg/960px-Lange-MigrantMother02.jpg',
    alt: 'Migrant mother during the Great Depression',
    position: 'center 40%',
    credit: 'Dorothea Lange / U.S. Farm Security Administration / Wikimedia Commons (public domain).',
    priority: 84,
  },
  {
    key: 'full-timeline',
    patterns: [
      /five centuries/i,
      /family across generations/i,
      /documented family timeline/i,
      /colonial and frontier years/i,
      /twentieth-century family life/i,
    ],
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Nebel_Voyage_11_Hacendero.jpg/960px-Nebel_Voyage_11_Hacendero.jpg',
    alt: 'Mexican hacienda scene, 1836 lithograph',
    position: 'center 46%',
    credit: 'Carl Nebel / Wikimedia Commons (public domain).',
    priority: 70,
  },
]

const DEFAULT_PLAQUE_BACKGROUND: ChapterPlaqueBackground = {
  key: 'archival-horizon',
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Nebel_Voyage_05_Pyramid_of_Papantla.jpg/960px-Nebel_Voyage_05_Pyramid_of_Papantla.jpg',
  alt: 'Mexican landscape, 1836 lithograph',
  position: 'center 50%',
  credit: 'Carl Nebel / Wikimedia Commons (public domain).',
}

export function resolveChapterPlaqueBackground(input: {
  title: string
  summary: string | null
}): ChapterPlaqueBackground {
  const haystack = `${input.title} ${input.summary ?? ''}`.trim()

  let best: ImageryRule | null = null
  for (const rule of PLAQUE_IMAGERY_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(haystack))) continue
    if (!best || rule.priority > best.priority) best = rule
  }

  if (!best) return DEFAULT_PLAQUE_BACKGROUND

  return {
    key: best.key,
    src: best.src,
    alt: best.alt,
    position: best.position,
    credit: best.credit,
  }
}
