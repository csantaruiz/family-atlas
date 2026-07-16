import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { carouselStories } from '../data/carouselStories'

const AUTO_ADVANCE_MS = 8000

function formatDateRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', { year: 'numeric' })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

export function HighlightCarousel() {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const story = carouselStories[index]

  const goTo = useCallback((nextIndex: number, nextDirection: number) => {
    setDirection(nextDirection)
    setIndex((nextIndex + carouselStories.length) % carouselStories.length)
  }, [])

  const goPrev = useCallback(() => {
    goTo(index - 1, -1)
  }, [goTo, index])

  const goNext = useCallback(() => {
    goTo(index + 1, 1)
  }, [goTo, index])

  useEffect(() => {
    if (isPaused) return

    const timer = window.setInterval(goNext, AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [goNext, isPaused])

  const slideVariants = {
    enter: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection >= 0 ? 24 : -24,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (slideDirection: number) => ({
      opacity: 0,
      x: slideDirection >= 0 ? -24 : 24,
    }),
  }

  return (
    <section
      aria-label="Highlighted stories"
      className="w-full max-w-sm md:max-w-md"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false)
        }
      }}
    >
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.article
            key={story.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="carousel-card px-5 py-4 md:px-6 md:py-5"
          >
            <p className="text-[0.6875rem] tracking-[0.08em] text-atlas-gold-dim uppercase">
              {formatDateRange(story.dateRange.start, story.dateRange.end)}
            </p>
            <h2 className="font-serif mt-2 text-xl leading-snug font-medium text-atlas-gold md:text-2xl">
              {story.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-atlas-text">{story.excerpt}</p>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous story"
            className="text-atlas-gold-dim transition-colors hover:text-atlas-gold"
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next story"
            className="text-atlas-gold-dim transition-colors hover:text-atlas-gold"
          >
            <ChevronRight className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center gap-2" role="tablist" aria-label="Story pagination">
          {carouselStories.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Story ${dotIndex + 1}: ${item.title}`}
              onClick={() => goTo(dotIndex, dotIndex > index ? 1 : -1)}
              className={`h-1.5 rounded-full transition-all ${
                dotIndex === index
                  ? 'w-4 bg-atlas-gold-soft'
                  : 'w-1.5 bg-atlas-gold-dim/60 hover:bg-atlas-gold-dim'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
