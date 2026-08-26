import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { FamilyMarriage } from '../data/familyMarriages'
import type { FamilyDatabase } from '../types'
import { applyPersonOverrides } from '../overrides/applyPersonNameOverrides'
import { assignPersonGenerations } from '../gedcom/assignGenerations'
import { subscribeOverrideCache } from '../overrides/overrideCache'
import {
  getActiveFamilyData,
  setActiveFamilyData,
  type ActiveFamilyData,
} from './activeFamily'

type FamilyDataContextValue = ActiveFamilyData & {
  ready: boolean
  reload: () => Promise<void>
}

const FamilyDataContext = createContext<FamilyDataContextValue | null>(null)

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ActiveFamilyData>(() => getActiveFamilyData())
  const [ready, setReady] = useState(false)
  const [overrideTick, setOverrideTick] = useState(0)

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/family/snapshot')
      const payload = response.ok
        ? ((await response.json()) as { database?: FamilyDatabase; marriages?: FamilyMarriage[]; importId?: string | null })
        : null
      if (payload?.database?.people?.length) {
        const next: ActiveFamilyData = {
          database: payload.database,
          marriages: payload.marriages ?? [],
          importId: payload.importId ?? null,
        }
        setActiveFamilyData(next)
        setData(next)
      }
    } catch {
      /* keep current family data */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void reload().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => subscribeOverrideCache(() => setOverrideTick((n) => n + 1)), [])

  const value = useMemo(
    () => ({
      ...data,
      database: {
        ...data.database,
        people: assignPersonGenerations(
          applyPersonOverrides(data.database.people),
          data.database.root,
        ),
      },
      ready,
      reload,
    }),
    [data, ready, reload, overrideTick],
  )
  return <FamilyDataContext.Provider value={value}>{children}</FamilyDataContext.Provider>
}

export function useFamilyData(): FamilyDataContextValue {
  const value = useContext(FamilyDataContext)
  if (!value) {
    const fallback = getActiveFamilyData()
    return { ...fallback, ready: true, reload: async () => {} }
  }
  return value
}
