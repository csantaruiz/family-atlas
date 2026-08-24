import { createContext, useContext, type ReactNode } from 'react'

export type PhoneDiscoverySheet = 'story' | 'thinking' | null

export type PhoneTimelineUiValue = {
  phone: boolean
  exploring: boolean
  sheet: PhoneDiscoverySheet
  beginExploring: () => void
  restoreArrival: () => void
  openSheet: (sheet: PhoneDiscoverySheet) => void
}

const PhoneTimelineUiContext = createContext<PhoneTimelineUiValue | null>(null)

export function PhoneTimelineUiProvider({
  value,
  children,
}: {
  value: PhoneTimelineUiValue
  children: ReactNode
}) {
  return <PhoneTimelineUiContext.Provider value={value}>{children}</PhoneTimelineUiContext.Provider>
}

export function usePhoneTimelineUi(): PhoneTimelineUiValue | null {
  return useContext(PhoneTimelineUiContext)
}
