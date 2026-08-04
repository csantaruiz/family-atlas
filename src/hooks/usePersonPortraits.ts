import { useSyncExternalStore } from 'react'
import {
  getPersonPortraitSnapshot,
  subscribePersonPortraits,
  type PersonPortraitMap,
} from '../utils/personPortraitStore'

const EMPTY: PersonPortraitMap = {}

export function usePersonPortraits(): PersonPortraitMap {
  return useSyncExternalStore(
    subscribePersonPortraits,
    getPersonPortraitSnapshot,
    () => EMPTY,
  )
}
