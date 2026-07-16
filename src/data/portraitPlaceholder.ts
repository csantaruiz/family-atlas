import type { PersonImage } from '../types'
import archivalPlaceholder from '../assets/portraits/archival-placeholder.jpg'

/**
 * Archival portrait used for layout evaluation only.
 * Source: Wikimedia Commons — "Portrait ca 1856-1900" (SFF-88110 055)
 * Photographer: Unknown. Tintype, ca. 1880.
 * Fylkesarkivet i Sogn og Fjordane via Flickr Commons.
 * License: No known copyright restrictions (public domain).
 * @see https://commons.wikimedia.org/wiki/File:Portrait_ca_1856-1900._(4732552500).jpg
 */
export const ARCHIVAL_PORTRAIT_PLACEHOLDER: PersonImage = {
  src: archivalPlaceholder,
  alt: 'Black-and-white archival portrait used as a layout example',
  caption: 'Archival portrait placeholder',
  credit: 'Unknown photographer, ca. 1880. Fylkesarkivet i Sogn og Fjordane / Wikimedia Commons (public domain).',
  isPlaceholder: true,
}
