import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useFollowPerson } from '../../context/FollowPersonContext'
import { FollowPersonMap } from './FollowPersonMap'

export function FollowPersonOverlay() {
  const { active, journey, beat, beatIndex, playing, togglePlay, next, prev, goToBeat, exit, exploreHere } =
    useFollowPerson()
  const prefersReducedMotion = useReducedMotion()

  if (!active || !journey || !beat) return null

  const fade = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.45, ease: [0.22, 0.8, 0.2, 1] as const }

  return (
    <div
      className="follow-person-overlay"
      role="dialog"
      aria-label={`Following ${journey.ctaLabel.replace(/^Follow /, '')}`}
    >
      <FollowPersonMap journey={journey} beat={beat} />

      <div className="follow-person-hud">
        <div className="follow-person-kicker">
          {journey.ctaLabel.replace(/^Follow /, '')}
          <span className="follow-person-progress">
            {beatIndex + 1} / {journey.beats.length}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={beat.id}
            className="follow-person-copy"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
            transition={fade}
          >
            {beat.yearLabel ? <div className="follow-person-year">{beat.yearLabel}</div> : null}
            <h2 className="follow-person-title">{beat.title}</h2>
            {beat.locationLabel ? (
              <div className="follow-person-place">{beat.locationLabel}</div>
            ) : null}
            <p className="follow-person-caption">{beat.caption}</p>
            <div className={`follow-person-evidence follow-person-evidence--${beat.evidence}`}>
              {beat.evidenceLabel}
            </div>
          </motion.div>
        </AnimatePresence>

        {beat.image ? (
          <figure className={`follow-person-image follow-person-image--${beat.imageKind}`}>
            <img src={beat.image.src} alt={beat.image.alt} />
            <figcaption>
              {beat.imageKind === 'stock' ? 'Period stock' : 'Family photograph'}
              {beat.image.credit ? ` · ${beat.image.credit}` : ''}
            </figcaption>
          </figure>
        ) : null}
      </div>

      <div className="follow-person-controls">
        <button type="button" className="follow-person-btn" onClick={prev} disabled={beatIndex === 0}>
          Prev
        </button>
        <button type="button" className="follow-person-btn follow-person-btn--primary" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="follow-person-btn"
          onClick={next}
          disabled={beatIndex >= journey.beats.length - 1}
        >
          Next
        </button>
        <button type="button" className="follow-person-btn" onClick={exploreHere}>
          Explore here
        </button>
        <button type="button" className="follow-person-btn follow-person-btn--ghost" onClick={exit}>
          Exit
        </button>
        <div className="follow-person-dots" role="tablist" aria-label="Journey beats">
          {journey.beats.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === beatIndex}
              className={`follow-person-dot${index === beatIndex ? ' is-active' : ''}`}
              onClick={() => goToBeat(index)}
            >
              <span className="sr-only">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
