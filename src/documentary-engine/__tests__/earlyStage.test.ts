import { describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import {
  isEarlyDocumentaryStage,
  resolveEarlyPreviewMarkers,
} from '../core/earlyStageDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'

const DURATION_MS = 384_888

describe('early stage director', () => {
  it('treats opening and Cheshire as early documentary stages', () => {
    expect(isEarlyDocumentaryStage(24_000, 'Opening', 'world-establishing')).toBe(true)
    expect(isEarlyDocumentaryStage(50_000, 'Origins in Cheshire', 'local-place')).toBe(true)
    expect(isEarlyDocumentaryStage(100_000, 'Spain & Chihuahua', 'branch-transition')).toBe(false)
  })

  it('pulses each future location once inside the opening window', () => {
    const markers = resolveEarlyPreviewMarkers(20_000)
    expect(markers).toHaveLength(1)
    expect(markers[0]?.preview).toBe(true)
    expect(markers[0]?.placeId).toBe('spain')

    const later = resolveEarlyPreviewMarkers(20_000 + 3_500)
    expect(later).toHaveLength(0)
  })

  it('adds preview markers to the opening frame', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 20_000, DURATION_MS)
    expect(frame?.markers.some((marker) => marker.preview && marker.placeId === 'spain')).toBe(
      true,
    )
  })

  it('stops preview markers after the early act', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 120_000, DURATION_MS)
    expect(frame?.markers.some((marker) => marker.preview)).toBe(false)
  })
})
