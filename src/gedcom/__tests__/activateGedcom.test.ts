import { describe, expect, it } from 'vitest'
import { emptyIdentityStore, seedAtlasPeople } from '../../atlas-identity/seedAtlasPeople'
import { classifyIdentityTiers } from '../classifyIdentity'
import { collectStaticAtlasAttachments } from '../attachments'
import { diffFamilyGraphs } from '../diffFamilyGraphs'
import { parseGedcom } from '../parseGedcom'
import { planGedcomReconciliation } from '../planGedcomReconciliation'
import { familySnapshotFromGraph } from '../import/snapshotFromGraph'
import { applyActivationPlan, commitActivationPlan, type ActivationStore } from '../activate/applyActivation'
import { planGedcomActivation } from '../activate/planActivation'
import { familyDatabaseFromSnapshot, rewriteSnapshotToAtlasIds } from '../activate/rewriteSnapshot'
import { buildGedcom } from './gedcomFixture'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { buildFamilyTreeLayout } from '../../utils/buildFamilyTree'

const ATLAS_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ATLAS_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function familyGedcom(ids: { alice: string; bob: string; carol: string }) {
  return buildGedcom(
    [
      {
        id: ids.alice,
        name: 'Alice Ruiz',
        sex: 'F',
        birthDate: '1 Jan 1900',
        birthPlace: 'Oregon',
        fams: ['F1'],
      },
      {
        id: ids.bob,
        name: 'Bob Ruiz',
        sex: 'M',
        birthDate: '2 Feb 1898',
        birthPlace: 'Texas',
        fams: ['F1'],
      },
      {
        id: ids.carol,
        name: 'Carol Ruiz',
        sex: 'F',
        birthDate: '3 Mar 1922',
        birthPlace: 'California',
        famc: ['F1'],
      },
    ],
    [
      {
        id: 'F1',
        husbandId: ids.bob,
        wifeId: ids.alice,
        children: [ids.carol],
        marriageDate: '4 Apr 1920',
        marriagePlace: 'Texas',
      },
    ],
  )
}

function seedStore(atlasId: string, people: Array<{ id: string; name: string; birthYear: number | null }>) {
  const identity = emptyIdentityStore()
  seedAtlasPeople(identity, { atlasId, people })
  return identity
}

function planFromGraphs(currentGed: string, candidateGed: string, attachments?: { personId: string; label: string }[]) {
  const current = parseGedcom(currentGed)
  const candidate = parseGedcom(candidateGed)
  const diff = diffFamilyGraphs(current, candidate)
  const identity = classifyIdentityTiers(diff, current, candidate)
  const staticAttachments = collectStaticAtlasAttachments()
  const recon = planGedcomReconciliation(diff, {
    current,
    candidate,
    media: (attachments ?? []).map((row) => ({
      kind: 'media' as const,
      id: `media-${row.personId}`,
      personId: row.personId,
      label: row.label,
    })),
    stories: staticAttachments.stories,
    documentary: staticAttachments.documentary,
    placeOverrides: [],
    eventOverrides: [],
  })
  const snapshot = familySnapshotFromGraph(candidate, current.people[0]?.id ?? 'I1')
  const existing = seedStore(ATLAS_A, current.people.map((person) => ({
    id: person.id,
    name: person.name,
    birthYear: person.birthYear,
  })))
  let n = 0
  const activation = planGedcomActivation({
    atlasId: ATLAS_A,
    currentRootGedcomId: 'I1',
    identity,
    plan: recon,
    existing,
    candidate,
    snapshot,
    eventOverrides: [],
    createId: () => `atlas-${++n}`,
  })
  return { current, candidate, diff, identity, recon, snapshot, activation, existing }
}

describe('2D.3C activation planner', () => {
  it('reuses Atlas UUIDs on exact-match activation', () => {
    const ged = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const { activation } = planFromGraphs(ged, ged)
    expect(activation.blocked).toBe(false)
    expect(activation.ops.filter((op) => op.action === 'reuse_exact')).toHaveLength(3)
    expect(new Set(Object.values(activation.gedcomToAtlas)).size).toBe(3)
  })

  it('keeps the same Atlas UUID when a GEDCOM id changes on a strong match', () => {
    const currentGed = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const candidateGed = familyGedcom({ alice: 'I101', bob: 'I102', carol: 'I103' })
    const existing = seedStore(ATLAS_A, [
      { id: 'I1', name: 'Alice Ruiz', birthYear: 1900 },
      { id: 'I2', name: 'Bob Ruiz', birthYear: 1898 },
      { id: 'I3', name: 'Carol Ruiz', birthYear: 1922 },
    ])
    const current = parseGedcom(currentGed)
    const candidate = parseGedcom(candidateGed)
    const diff = diffFamilyGraphs(current, candidate)
    const identity = classifyIdentityTiers(diff, current, candidate)
    const recon = planGedcomReconciliation(diff, {
      current,
      candidate,
      media: [],
      stories: [],
      documentary: [],
      placeOverrides: [],
      eventOverrides: [],
    })
    const aliceBefore = existing.people.find((row) => row.currentSourcePersonId === 'I1')?.id
    const activation = planGedcomActivation({
      atlasId: ATLAS_A,
      currentRootGedcomId: 'I1',
      identity,
      plan: recon,
      existing,
      candidate,
      snapshot: familySnapshotFromGraph(candidate, 'I1'),
      eventOverrides: [],
      createId: () => 'should-not-create',
    })
    expect(activation.blocked).toBe(false)
    expect(activation.gedcomToAtlas.I101).toBe(aliceBefore)
    expect(activation.ops.find((op) => op.candidateGedcomId === 'I101')?.action).toBe('reuse_strong')
  })

  it('creates a new UUID for a genuinely new person', () => {
    const currentGed = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const candidateGed = buildGedcom(
      [
        ...parseGedcom(currentGed).people.map((person) => ({
          id: person.id,
          name: person.name,
          sex: person.sex,
          birthDate: person.birthDate,
          birthPlace: person.birthPlace,
        })),
        { id: 'I9', name: 'New Relative', sex: 'F', birthDate: '2001' },
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
    const { activation } = planFromGraphs(currentGed, candidateGed)
    const created = activation.ops.find((op) => op.candidateGedcomId === 'I9')
    expect(created?.action).toBe('create')
    expect(activation.gedcomToAtlas.I9).toBeTruthy()
  })

  it('preserves a removed person as source_removed', () => {
    const currentGed = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const candidateGed = buildGedcom(
      [
        {
          id: 'I1',
          name: 'Alice Ruiz',
          sex: 'F',
          birthDate: '1 Jan 1900',
          birthPlace: 'Oregon',
          fams: ['F1'],
        },
        {
          id: 'I2',
          name: 'Bob Ruiz',
          sex: 'M',
          birthDate: '2 Feb 1898',
          birthPlace: 'Texas',
          fams: ['F1'],
        },
      ],
      [
        {
          id: 'F1',
          husbandId: 'I2',
          wifeId: 'I1',
          marriageDate: '4 Apr 1920',
          marriagePlace: 'Texas',
        },
      ],
    )
    const { activation, existing } = planFromGraphs(currentGed, candidateGed)
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: existing.people,
      aliases: existing.aliases,
      imports: [
        { id: 'prev', atlasId: ATLAS_A, status: 'active' },
        { id: 'next', atlasId: ATLAS_A, status: 'ready' },
      ],
      media: [
        {
          id: 'm-carol',
          atlasId: ATLAS_A,
          personId: 'I3',
          atlasPersonId: existing.people.find((row) => row.currentSourcePersonId === 'I3')?.id ?? null,
        },
      ],
      eventOverrides: [],
    }
    const next = applyActivationPlan(store, activation, 'next')
    const carol = next.people.find((row) => row.currentSourcePersonId === 'I3' || row.displayName === 'Carol Ruiz')
    expect(carol?.status).toBe('source_removed')
    expect(next.media.find((row) => row.id === 'm-carol')?.atlasPersonId).toBe(carol?.id)
  })

  it('blocks activation when an ambiguous identity has a portrait', () => {
    const currentGed = buildGedcom([
      { id: 'I1', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I2', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const candidateGed = buildGedcom([
      { id: 'I9', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I8', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const { activation } = planFromGraphs(currentGed, candidateGed, [
      { personId: 'I1', label: 'John portrait' },
    ])
    expect(activation.blocked).toBe(true)
    expect(activation.blockers.some((row) => row.code === 'ambiguous_identity_with_content')).toBe(true)
  })

  it('leaves the previous import active when activation is blocked', () => {
    const currentGed = buildGedcom([
      { id: 'I1', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I2', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const candidateGed = buildGedcom([
      { id: 'I9', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I8', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const { activation } = planFromGraphs(currentGed, candidateGed, [
      { personId: 'I1', label: 'John portrait' },
    ])
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: [],
      aliases: [],
      imports: [
        { id: 'prev', atlasId: ATLAS_A, status: 'active' },
        { id: 'next', atlasId: ATLAS_A, status: 'ready' },
      ],
      media: [],
      eventOverrides: [],
    }
    expect(() => applyActivationPlan(store, activation, 'next')).toThrow(/blocked/)
    expect(store.activeImportId).toBe('prev')
    expect(store.imports.find((row) => row.id === 'prev')?.status).toBe('active')
  })

  it('does not attach an event override to a nearby year', () => {
    const currentGed = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const candidateGed = familyGedcom({ alice: 'I101', bob: 'I102', carol: 'I103' })
    const current = parseGedcom(currentGed)
    const candidate = parseGedcom(candidateGed)
    const diff = diffFamilyGraphs(current, candidate)
    const identity = classifyIdentityTiers(diff, current, candidate)
    const recon = planGedcomReconciliation(diff, {
      current,
      candidate,
      media: [],
      stories: [],
      documentary: [],
      placeOverrides: [],
      eventOverrides: [],
    })
    const existing = seedStore(ATLAS_A, current.people.map((person) => ({
      id: person.id,
      name: person.name,
      birthYear: person.birthYear,
    })))
    const activation = planGedcomActivation({
      atlasId: ATLAS_A,
      currentRootGedcomId: 'I1',
      identity,
      plan: recon,
      existing,
      candidate,
      snapshot: familySnapshotFromGraph(candidate, 'I1'),
      eventOverrides: [{ id: 'ev1', entityKey: 'I1:birth:1899:oregon' }],
      createId: () => 'x',
    })
    expect(activation.eventRewrites[0]?.keep).toBe(false)
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: existing.people,
      aliases: existing.aliases,
      imports: [
        { id: 'prev', atlasId: ATLAS_A, status: 'active' },
        { id: 'next', atlasId: ATLAS_A, status: 'ready' },
      ],
      media: [],
      eventOverrides: [{ id: 'ev1', entityKey: 'I1:birth:1899:oregon', status: 'active' }],
    }
    const next = applyActivationPlan(store, activation, 'next')
    expect(next.eventOverrides[0]?.status).toBe('orphaned')
    expect(next.eventOverrides[0]?.entityKey).toBe('I1:birth:1899:oregon')
  })

  it('rewrites the snapshot so Timeline/Tree/People/Journey can consume Atlas ids', () => {
    const currentGed = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const candidateGed = familyGedcom({ alice: 'I101', bob: 'I102', carol: 'I103' })
    const { activation, snapshot } = planFromGraphs(currentGed, candidateGed)
    const rewritten = rewriteSnapshotToAtlasIds(
      snapshot,
      new Map(Object.entries(activation.gedcomToAtlas)),
    )
    expect(rewritten.people.every((person) => person.sourcePersonId?.startsWith('I'))).toBe(true)
    expect(rewritten.people.every((person) => person.id !== person.sourcePersonId)).toBe(true)
    const db = familyDatabaseFromSnapshot(rewritten)
    const events = buildFamilyEvents(db.people, rewritten.marriages)
    expect(events.length).toBeGreaterThan(0)
    const layout = buildFamilyTreeLayout(
      Object.fromEntries(db.people.map((person) => [person.id, person])),
      db.people.map((person) => person.id),
      db.root,
    )
    expect(layout.nodes.length).toBeGreaterThan(0)
  })

  it('cannot apply an Atlas B candidate onto Atlas A state', () => {
    const ged = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const { activation } = planFromGraphs(ged, ged)
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: [],
      aliases: [],
      imports: [{ id: 'b-import', atlasId: ATLAS_B, status: 'ready' }],
      media: [],
      eventOverrides: [],
    }
    expect(store.imports[0]?.atlasId).not.toBe(store.atlasId)
    expect(store.imports.some((row) => row.id === 'b-import' && row.atlasId === ATLAS_A)).toBe(false)
    expect(activation.ops.length).toBeGreaterThan(0)
  })


  it('rolls back in memory when persist fails and leaves the previous import active', () => {
    const ged = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const { activation } = planFromGraphs(ged, ged)
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: [],
      aliases: [],
      imports: [
        { id: 'prev', atlasId: ATLAS_A, status: 'active' },
        { id: 'next', atlasId: ATLAS_A, status: 'ready' },
      ],
      media: [],
      eventOverrides: [],
    }
    expect(() =>
      commitActivationPlan(store, activation, 'next', () => {
        throw new Error('db write failed')
      }),
    ).toThrow(/db write failed/)
    expect(store.activeImportId).toBe('prev')
    expect(store.imports.find((row) => row.id === 'prev')?.status).toBe('active')
  })

  it('refuses to apply Atlas B import rows onto Atlas A', () => {
    const ged = familyGedcom({ alice: 'I1', bob: 'I2', carol: 'I3' })
    const { activation } = planFromGraphs(ged, ged)
    const store: ActivationStore = {
      atlasId: ATLAS_A,
      activeImportId: 'prev',
      people: [],
      aliases: [],
      imports: [
        { id: 'prev', atlasId: ATLAS_A, status: 'active' },
        { id: 'b-import', atlasId: ATLAS_B, status: 'ready' },
      ],
      media: [],
      eventOverrides: [],
    }
    expect(() => applyActivationPlan(store, activation, 'b-import')).toThrow(/does not belong/)
    expect(store.activeImportId).toBe('prev')
  })

})
