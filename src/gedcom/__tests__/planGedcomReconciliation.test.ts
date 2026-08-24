import { describe, expect, it } from 'vitest'
import { placeEntityKey, placeSourceSignature } from '../../overrides/identity'
import { collectStaticAtlasAttachments } from '../attachments'
import { compareGedcomTexts } from '../compareGedcom'
import { parseGedcom } from '../parseGedcom'
import { planGedcomReconciliation } from '../planGedcomReconciliation'
import { buildGedcom } from './gedcomFixture'

const FAMILY_CURRENT = buildGedcom(
  [
    { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1 Jan 1900', birthPlace: 'Oregon', fams: ['F1'] },
    { id: 'I2', name: 'Bob Ruiz', sex: 'M', birthDate: '2 Feb 1898', birthPlace: 'Texas', fams: ['F1'] },
    { id: 'I3', name: 'Carol Ruiz', sex: 'F', birthDate: '3 Mar 1922', birthPlace: 'California', famc: ['F1'] },
  ],
  [
    {
      id: 'F1',
      husbandId: 'I2',
      wifeId: 'I1',
      children: ['I3'],
      marriageDate: '4 Apr 1920',
      marriagePlace: 'Texas',
    },
  ],
)

const FAMILY_RENUMBERED = buildGedcom(
  [
    { id: 'I101', name: 'Alice Ruiz', sex: 'F', birthDate: '1 Jan 1900', birthPlace: 'Oregon', fams: ['F9'] },
    { id: 'I102', name: 'Bob Ruiz', sex: 'M', birthDate: '2 Feb 1898', birthPlace: 'Texas', fams: ['F9'] },
    { id: 'I103', name: 'Carol Ruiz', sex: 'F', birthDate: '3 Mar 1922', birthPlace: 'California', famc: ['F9'] },
  ],
  [
    {
      id: 'F9',
      husbandId: 'I102',
      wifeId: 'I101',
      children: ['I103'],
      marriageDate: '4 Apr 1920',
      marriagePlace: 'Texas',
    },
  ],
)

function emptyOverrides() {
  return {
    media: [] as { kind: 'media'; id: string; personId: string; label: string }[],
    stories: [] as { kind: 'story'; id: string; personId: string; label: string }[],
    documentary: [] as { kind: 'documentary'; id: string; personId: string; label: string }[],
    placeOverrides: [] as {
      kind: 'place_override'
      id: string
      entityKey: string
      sourceSignature: string
      label: string
    }[],
    eventOverrides: [] as {
      kind: 'event_override'
      id: string
      entityKey: string
      sourceSignature: string
      label: string
    }[],
  }
}

describe('2D.2 reconciliation planner', () => {
  it('rebinds media when a renumbered person has strong family corroboration', () => {
    const diff = compareGedcomTexts(FAMILY_CURRENT, FAMILY_RENUMBERED)
    const current = parseGedcom(FAMILY_CURRENT)
    const candidate = parseGedcom(FAMILY_RENUMBERED)
    const plan = planGedcomReconciliation(diff, {
      current,
      candidate,
      ...emptyOverrides(),
      media: [{ kind: 'media', id: 'photo-alice', personId: 'I1', label: 'Alice portrait' }],
    })
    const alice = plan.identity.find((row) => row.currentId === 'I1')
    expect(alice?.tier).toBe('strong_match')
    expect(alice?.safeToRebindAttachments).toBe(true)
    expect(alice?.evidence.some((item) => /parent|spouse|child/i.test(item))).toBe(true)
    const photo = plan.attachments.find((row) => row.id === 'photo-alice')
    expect(photo?.action).toBe('rebind')
    expect(photo?.candidatePersonId).toBe('I101')
  })

  it('does not auto-rebind a unique name/year match without family corroboration', () => {
    const currentGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: 'Oregon' },
    ])
    const candidateGed = buildGedcom([
      { id: 'I101', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: 'Oregon' },
    ])
    const diff = compareGedcomTexts(currentGed, candidateGed)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(currentGed),
      candidate: parseGedcom(candidateGed),
      ...emptyOverrides(),
      media: [{ kind: 'media', id: 'photo-alice', personId: 'I1', label: 'Alice portrait' }],
    })
    const alice = plan.identity.find((row) => row.currentId === 'I1')
    expect(alice?.tier).toBe('ambiguous')
    expect(alice?.safeToRebindAttachments).toBe(false)
    expect(plan.attachments[0]?.action).toBe('needs_review')
  })

  it('keeps duplicate-name relatives ambiguous', () => {
    const currentGed = buildGedcom([
      { id: 'I1', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I2', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const candidateGed = buildGedcom([
      { id: 'I9', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I8', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const diff = compareGedcomTexts(currentGed, candidateGed)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(currentGed),
      candidate: parseGedcom(candidateGed),
      ...emptyOverrides(),
      media: [{ kind: 'media', id: 'photo-john', personId: 'I1', label: 'John portrait' }],
    })
    expect(plan.identity.every((row) => row.tier === 'ambiguous')).toBe(true)
    expect(plan.attachments[0]?.action).toBe('needs_review')
    expect(plan.attachments[0]?.action).not.toBe('rebind')
  })

  it('orphans media for a removed person and never deletes it', () => {
    const currentGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900' },
      { id: 'I2', name: 'Old Relative', sex: 'M', birthDate: '1870' },
    ])
    const candidateGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900' },
    ])
    const diff = compareGedcomTexts(currentGed, candidateGed)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(currentGed),
      candidate: parseGedcom(candidateGed),
      ...emptyOverrides(),
      media: [{ kind: 'media', id: 'photo-old', personId: 'I2', label: 'Old portrait' }],
    })
    const old = plan.identity.find((row) => row.currentId === 'I2')
    expect(old?.tier).toBe('unmatched')
    expect(plan.attachments[0]).toMatchObject({
      id: 'photo-old',
      action: 'orphan',
      currentPersonId: 'I2',
    })
    expect(plan.attachments[0]?.action).toBe('orphan')
    expect(['preserve', 'rebind', 'needs_review', 'orphan']).toContain(plan.attachments[0]?.action)
  })

  it('preserves an unchanged place confirmation', () => {
    const place = 'Medord, Oregon, USA'
    const currentGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: place },
    ])
    const candidateGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: place },
    ])
    const diff = compareGedcomTexts(currentGed, candidateGed)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(currentGed),
      candidate: parseGedcom(candidateGed),
      ...emptyOverrides(),
      placeOverrides: [
        {
          kind: 'place_override',
          id: 'place-1',
          entityKey: placeEntityKey(place),
          sourceSignature: placeSourceSignature(place),
          label: 'Confirmed Medord',
        },
      ],
    })
    expect(plan.attachments[0]?.action).toBe('preserve')
  })

  it('sends a place confirmation to needs_review when the source signature changes', () => {
    const place = 'Forkston, Wyoming, Pennsylvania, United States'
    const currentGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: place },
    ])
    const candidateGed = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900', birthPlace: place },
    ])
    const diff = compareGedcomTexts(currentGed, candidateGed)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(currentGed),
      candidate: parseGedcom(candidateGed),
      ...emptyOverrides(),
      placeOverrides: [
        {
          kind: 'place_override',
          id: 'place-1',
          entityKey: placeEntityKey(place),
          sourceSignature: 'stale-signature',
          label: 'Confirmed Forkston',
        },
      ],
    })
    expect(plan.attachments[0]?.action).toBe('needs_review')
  })

  it('does not attach an event override to a nearby year after person remapping', () => {
    const diff = compareGedcomTexts(FAMILY_CURRENT, FAMILY_RENUMBERED)
    const plan = planGedcomReconciliation(diff, {
      current: parseGedcom(FAMILY_CURRENT),
      candidate: parseGedcom(FAMILY_RENUMBERED),
      ...emptyOverrides(),
      eventOverrides: [
        {
          kind: 'event_override',
          id: 'event-1',
          entityKey: 'I1:birth:1899:oregon',
          sourceSignature: 'sig',
          label: 'Alice birth override',
        },
      ],
    })
    const event = plan.attachments.find((row) => row.id === 'event-1')
    expect(event?.action).toBe('orphan')
    expect(event?.reason).toMatch(/nearby years are not used/i)
  })

  it('collects repo stories and documentary person references without network I/O', () => {
    const staticAttachments = collectStaticAtlasAttachments()
    expect(staticAttachments.stories.length).toBeGreaterThan(0)
    expect(staticAttachments.documentary.length).toBeGreaterThan(0)
    expect(staticAttachments.stories.every((row) => row.personId.startsWith('I'))).toBe(true)
  })
})
