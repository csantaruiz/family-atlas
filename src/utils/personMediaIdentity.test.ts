import { describe, expect, it } from 'vitest'
import { chooseStoredPersonKeys } from '../../api/_lib/personMediaIdentity'

const ATLAS_ID = '8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8'

describe('chooseStoredPersonKeys', () => {
  it('keeps a GEDCOM id as the stored key when that is what the client sent', () => {
    expect(
      chooseStoredPersonKeys({
        requestedId: 'I18123023582',
        atlasPersonId: ATLAS_ID,
        currentSourcePersonId: 'I18123023582',
      }),
    ).toEqual({
      requestedId: 'I18123023582',
      storedPersonId: 'I18123023582',
      atlasPersonId: ATLAS_ID,
      sourcePersonId: 'I18123023582',
    })
  })

  it('stores the GEDCOM source id when the client sends a stable Atlas UUID', () => {
    expect(
      chooseStoredPersonKeys({
        requestedId: ATLAS_ID,
        atlasPersonId: ATLAS_ID,
        currentSourcePersonId: 'I18123023582',
      }),
    ).toEqual({
      requestedId: ATLAS_ID,
      storedPersonId: 'I18123023582',
      atlasPersonId: ATLAS_ID,
      sourcePersonId: 'I18123023582',
    })
  })

  it('falls back to the requested id when Atlas identity is not seeded', () => {
    expect(chooseStoredPersonKeys({ requestedId: 'I18123023582' })).toEqual({
      requestedId: 'I18123023582',
      storedPersonId: 'I18123023582',
      atlasPersonId: null,
      sourcePersonId: 'I18123023582',
    })
  })
})
