import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useFollowPerson } from '../../context/FollowPersonContext'
import { FollowPersonMap } from './FollowPersonMap'
import { usePresence } from '../../hooks/usePresence'
import { useMaxWidth } from '../../hooks/useMaxWidth'
import { PhoneCloseButton } from '../phone/PhoneSheet'
import { usePhoneOverlayLock } from '../../hooks/usePhoneOverlayLock'

function journeyHeading(givenName: string): string {
  const name = givenName.trim().toUpperCase()
  if (!name) return 'JOURNEY'
  return name.endsWith('S') ? `${name}’ JOURNEY` : `${name}’S JOURNEY`
}

export function FollowPersonOverlay() {
  const { active, journey, beat, beatIndex, playing, togglePlay, next, prev, goToBeat, exit, exploreHere } =
    useFollowPerson()
  const prefersReducedMotion = useReducedMotion()
  const phone = useMaxWidth(760)

  const overlay = usePresence(Boolean(active && journey && beat))
  usePhoneOverlayLock(overlay.present)
  if (!overlay.present || !journey || !beat) return null

  const fade = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: phone ? 0.2 : 0.45, ease: [0.22, 0.8, 0.2, 1] as const }
  const total = journey.beats.length
  const atStart = beatIndex === 0
  const atEnd = beatIndex >= total - 1

  return (
    <div
      className={`follow-person-overlay${overlay.shown ? ' is-open' : ''}`}
      role="dialog"
      aria-label={`${journeyHeading(journey.givenName)} · ${beatIndex + 1} of ${total}`}
    >
      <div className="follow-person-stage">
        <FollowPersonMap journey={journey} beat={beat} compact={phone} />
        <PhoneCloseButton className="follow-person-close" onClick={exit} />
      </div>
      <div className="follow-person-hud">
        <div className="follow-person-meta">
          <div className="follow-person-kicker">
            {phone ? journeyHeading(journey.givenName) : journey.ctaLabel.replace(/^Follow /, '')}
            <span className="follow-person-progress">
              {phone ? `· ${beatIndex + 1} OF ${total}` : `${beatIndex + 1} / ${total}`}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${beat.id}-meta`}
              className="follow-person-meta-copy"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              {beat.yearLabel ? <div className="follow-person-year">{beat.yearLabel}</div> : null}
              <h2 className="follow-person-title">{beat.title}</h2>
              {beat.locationLabel ? <div className="follow-person-place">{beat.locationLabel}</div> : null}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="follow-person-narrative">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${beat.id}-copy`}
              className="follow-person-copy"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <p className="follow-person-caption">{beat.caption}</p>
              <div className={`follow-person-evidence follow-person-evidence--${beat.evidence}`}>
                {beat.evidenceLabel}
              </div>
              {beat.image ? (
                <figure className={`follow-person-image follow-person-image--${beat.imageKind}`}>
                  <img src={beat.image.src} alt={beat.image.alt} />
                  <figcaption>
                    {beat.imageKind === 'stock' ? 'Period stock' : 'Family photograph'}
                    {beat.image.credit ? ` · ${beat.image.credit}` : ''}
                  </figcaption>
                </figure>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="follow-person-controls">
        <div className="follow-person-transport">
          <button type="button" className="follow-person-btn" onClick={prev} disabled={atStart}>
            ← Prev
          </button>
          <span className="follow-person-count">
            {beatIndex + 1} / {total}
          </span>
          <button type="button" className="follow-person-btn" onClick={next} disabled={atEnd}>
            Next →
          </button>
        </div>
        <div className="follow-person-actions">
          <button type="button" className="follow-person-btn follow-person-btn--primary" onClick={togglePlay}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="follow-person-btn" onClick={exploreHere}>
            Explore here
          </button>
        </div>
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
