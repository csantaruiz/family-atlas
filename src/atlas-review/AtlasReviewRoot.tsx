import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AtlasReviewOverlay } from './AtlasReviewOverlay'
import { selectCustomerReviews, type CustomerReviewItem } from './selectCustomerReviews'

type AtlasReviewContextValue = {
  count: number
  open: boolean
  openReview: () => void
  closeReview: () => void
  refresh: () => void
}

const AtlasReviewContext = createContext<AtlasReviewContextValue | null>(null)

export function useAtlasReview(): AtlasReviewContextValue {
  const value = useContext(AtlasReviewContext)
  if (!value) {
    throw new Error('useAtlasReview must be used within AtlasReviewRoot')
  }
  return value
}

export function AtlasReviewRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [introSeen, setIntroSeen] = useState(false)

  const items: CustomerReviewItem[] = useMemo(() => selectCustomerReviews(), [epoch])
  const count = items.length

  const refresh = useCallback(() => {
    setEpoch((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({
      count,
      open,
      openReview: () => setOpen(true),
      closeReview: () => setOpen(false),
      refresh,
    }),
    [count, open, refresh],
  )

  return (
    <AtlasReviewContext.Provider value={value}>
      {children}
      {open ? (
        <AtlasReviewOverlay
          items={items}
          showIntro={!introSeen}
          onIntroConsumed={() => setIntroSeen(true)}
          onClose={() => {
            setOpen(false)
            refresh()
          }}
          onQueueChanged={refresh}
        />
      ) : null}
    </AtlasReviewContext.Provider>
  )
}
