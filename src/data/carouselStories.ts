import type { FamilyStory } from '../types'

/** Temporary editorial stories for the Museum Shell carousel. Remove when Story Engine is wired. */
export const carouselStories: FamilyStory[] = [
  {
    id: 'story-century',
    title: 'More than a century on the timeline',
    dateRange: {
      start: new Date('1890-01-01'),
      end: new Date('2020-12-31'),
    },
    excerpt:
      'Five generations of the Santa Ruiz family traced across the American Southwest — from frontier towns to modern cities.',
    detailContent: '',
    relatedEventIds: [],
  },
  {
    id: 'story-ironworker',
    title: 'The ironworker generation',
    dateRange: {
      start: new Date('1920-01-01'),
      end: new Date('1975-12-31'),
    },
    excerpt:
      'Steel beams and bridge trusses defined a generation that built the infrastructure of the twentieth century.',
    detailContent: '',
    relatedEventIds: [],
  },
  {
    id: 'story-el-paso',
    title: 'From El Paso to the air war over Europe',
    dateRange: {
      start: new Date('1942-01-01'),
      end: new Date('1945-12-31'),
    },
    excerpt:
      'A journey from the borderlands of Texas to the skies above Germany — service, sacrifice, and the long road home.',
    detailContent: '',
    relatedEventIds: [],
  },
]
