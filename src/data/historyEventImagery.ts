import type { HistoryEvent, PersonImage } from '../types'

/** Stable lookup key for a history event record. */
export function historyEventHeroKey(event: Pick<HistoryEvent, 'year' | 'title'>): string {
  return `${event.year}|${event.title}`
}

const HISTORY_EVENT_HEROES: Record<string, PersonImage> = {
  '1485|Tudor dynasty begins': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/King_Henry_VII_from_NPG.jpg/960px-King_Henry_VII_from_NPG.jpg',
    alt: 'Portrait of Henry VII of England',
    credit: 'National Portrait Gallery / Wikimedia Commons (public domain).',
    caption: 'Henry VII after Bosworth',
  },
  '1534|English Reformation': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Portrait_of_Henry_VIII_of_England_%28Holbein%29.jpg/960px-Portrait_of_Henry_VIII_of_England_%28Holbein%29.jpg',
    alt: 'Portrait of Henry VIII',
    credit: 'Hans Holbein the Younger / Wikimedia Commons (public domain).',
    caption: 'Henry VIII and the break with Rome',
  },
  '1603|Union of the Crowns': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/JamesIEngland.jpg/960px-JamesIEngland.jpg',
    alt: 'Portrait of James VI and I',
    credit: 'After John de Critz / Wikimedia Commons (public domain).',
  },
  '1642|English Civil War begins': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Battle_of_Naseby.jpg',
    alt: 'Battle scene from the English Civil War',
    credit: 'Unknown artist, 17th century / Wikimedia Commons (public domain).',
  },
  '1660|The Restoration': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Charles_II_of_England.jpeg',
    alt: 'Portrait of Charles II',
    credit: 'After John Michael Wright / Wikimedia Commons (public domain).',
  },
  '1707|Kingdom of Great Britain': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Articles_of_Union_1707.jpg',
    alt: 'The Articles of Union, 1707',
    credit: 'Parliamentary Archives / Wikimedia Commons (public domain).',
  },
  '1776|American independence': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Declaration_of_Independence_%281819%29%2C_by_John_Trumbull.jpg/960px-Declaration_of_Independence_%281819%29%2C_by_John_Trumbull.jpg',
    alt: 'The Declaration of Independence',
    credit: 'John Trumbull, 1819 / U.S. Capitol / Wikimedia Commons (public domain).',
  },
  '1789|U.S. Constitution takes effect': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Washington%27s_inauguration_at_Philadelphia_cph.3g12011.jpg/960px-Washington%27s_inauguration_at_Philadelphia_cph.3g12011.jpg',
    alt: 'George Washington taking the oath of office',
    credit: 'Unknown artist, 19th century / Wikimedia Commons (public domain).',
  },
  '1810|Mexican War of Independence': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Campana_de_dolores.jpg/960px-Campana_de_dolores.jpg',
    alt: 'The bell of Dolores',
    credit: 'Photograph / Wikimedia Commons (public domain).',
    caption: 'Grito de Dolores',
  },
  '1821|Mexico becomes independent': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Agustin_de_Iturbide.jpg',
    alt: 'Portrait of Agustín de Iturbide',
    credit: '19th-century portrait / Wikimedia Commons (public domain).',
  },
  '1845|The Great Famine': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Irish_potato_famine_Bridget_O%27Donnel.jpg/960px-Irish_potato_famine_Bridget_O%27Donnel.jpg',
    alt: "Bridget O'Donnel during the Irish famine",
    credit: 'Illustrated London News, 1849 / Wikimedia Commons (public domain).',
  },
  '1846|Mexican–American War': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Battle_of_Resaca_de_la_Palma.jpg',
    alt: 'Battle of Resaca de la Palma',
    credit: 'Carl Nebel / Wikimedia Commons (public domain).',
  },
  '1848|Treaty of Guadalupe Hidalgo': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/3/33/Treaty_of_Guadalupe_Hidalgo.jpg',
    alt: 'The Treaty of Guadalupe Hidalgo',
    credit: 'U.S. National Archives / Wikimedia Commons (public domain).',
  },
  '1861|American Civil War': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Battle_of_Gettysburg%2C_by_Currier_and_Ives.png/960px-Battle_of_Gettysburg%2C_by_Currier_and_Ives.png',
    alt: 'Battle of Gettysburg',
    credit: 'Currier and Ives / Wikimedia Commons (public domain).',
  },
  '1862|French intervention in Mexico': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Maximilian_of_Mexico_Winterhalter.jpg',
    alt: 'Portrait of Maximilian I of Mexico',
    credit: 'Franz Xaver Winterhalter / Wikimedia Commons (public domain).',
  },
  '1876|Porfirian era begins': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Porfirio_Diaz_in_uniform.jpg',
    alt: 'Porfirio Díaz in uniform',
    credit: 'Photograph, ca. 1900 / Wikimedia Commons (public domain).',
  },
  '1910|Mexican Revolution': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Villa_y_zapata.jpg',
    alt: 'Emiliano Zapata and Pancho Villa',
    credit: 'Agustín Víctor Casasola / Wikimedia Commons (public domain).',
  },
  '1914|First World War': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Over_the_Top_Art.IWMART16975.jpg',
    alt: 'British soldiers going over the top',
    credit: 'Ernest Brooks / Imperial War Museums / Wikimedia Commons (public domain).',
  },
  '1917|Mexico’s Constitution of 1917': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Metro_Constitucion_de_1917_05.JPG/960px-Metro_Constitucion_de_1917_05.JPG',
    alt: 'Constitución de 1917 station mural',
    credit: 'Mexico City Metro / Wikimedia Commons (CC BY-SA 3.0).',
  },
  '1917|United States enters WWI': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/US_soldiers_returning_to_America_after_WWI.jpg',
    alt: 'American soldiers returning after the First World War',
    credit: 'U.S. Army / Wikimedia Commons (public domain).',
  },
  '1929|Great Depression': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Lange-MigrantMother02.jpg/960px-Lange-MigrantMother02.jpg',
    alt: 'Migrant mother during the Great Depression',
    credit: 'Dorothea Lange, 1936 / U.S. Farm Security Administration / Wikimedia Commons (public domain).',
  },
  '1939|Second World War begins': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Attack_on_Pearl_Harbor_Japanese_planes_view.jpg/960px-Attack_on_Pearl_Harbor_Japanese_planes_view.jpg',
    alt: 'Japanese aircraft over Pearl Harbor during the attack',
    credit: 'U.S. Navy / Wikimedia Commons (public domain).',
    caption: 'The Pacific war opens',
  },
  '1941|United States enters WWII': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/USS_Arizona_burning_Pearl_Harbor.jpg/960px-USS_Arizona_burning_Pearl_Harbor.jpg',
    alt: 'The USS Arizona burning at Pearl Harbor',
    credit: 'U.S. Navy / Wikimedia Commons (public domain).',
  },
  '1944|D-Day and the air war': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/NormandySupply_edit.jpg/960px-NormandySupply_edit.jpg',
    alt: 'Allied supply operations after the Normandy landings',
    credit: 'U.S. Army / Wikimedia Commons (public domain).',
  },
  '1964|Civil Rights Act': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Lyndon_Johnson_signing_Civil_Rights_Act%2C_July_2%2C_1964.jpg/960px-Lyndon_Johnson_signing_Civil_Rights_Act%2C_July_2%2C_1964.jpg',
    alt: 'President Lyndon Johnson signing the Civil Rights Act',
    credit: 'Cecil Stoughton / U.S. National Archives / Wikimedia Commons (public domain).',
  },
  '1969|Apollo 11': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Aldrin_Apollo_11.jpg/960px-Aldrin_Apollo_11.jpg',
    alt: 'Buzz Aldrin on the Moon during Apollo 11',
    credit: 'NASA / Wikimedia Commons (public domain).',
  },
  '1989|World Wide Web proposed': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/First_Web_Server.jpg/960px-First_Web_Server.jpg',
    alt: "Tim Berners-Lee's NeXT computer used for the first web server",
    credit: 'Silkebaron / Wikimedia Commons (CC BY 2.0).',
  },
  '2001|September 11 attacks': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/911_Memorial.jpg',
    alt: 'The National September 11 Memorial',
    credit: 'Wikimedia Commons (CC BY-SA 3.0).',
  },
  '2020|COVID-19 pandemic': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/SARS-CoV-2_%28CDC-23312%29.png/960px-SARS-CoV-2_%28CDC-23312%29.png',
    alt: 'SARS-CoV-2 virus particle illustration',
    credit: 'CDC / Wikimedia Commons (public domain).',
  },
}

export function getHistoryEventHeroImage(event: HistoryEvent): PersonImage | null {
  return HISTORY_EVENT_HEROES[historyEventHeroKey(event)] ?? null
}
