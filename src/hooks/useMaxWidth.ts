import { useEffect, useState } from 'react'

export function useMaxWidth(px: number): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(`(max-width: ${px}px)`).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${px}px)`)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [px])

  return matches
}
