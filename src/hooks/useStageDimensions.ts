import { useLayoutEffect, useRef, useState } from 'react'
import { isNarrowStage, isShortStage } from '../utils/stageBreakpoints'

export function useStageDimensions() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1000, height: 600 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      setSize({ width: el.clientWidth || 1000, height: el.clientHeight || 600 })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return {
    ref,
    ...size,
    isNarrow: isNarrowStage(size.width),
    isShort: isShortStage(size.height),
  }
}
