import { motion } from 'framer-motion'
import { useDocumentaryMode, formatDocumentaryDuration } from '../../context/DocumentaryModeContext'

export function DocumentaryWelcome() {
  const { stats, totalDurationMs, beginDocumentary, skipToAtlas } = useDocumentaryMode()

  const centurySpan = Math.max(1, Math.ceil(stats.yearSpan / 100))
  const centuryLabel = centurySpan === 1 ? 'century' : 'centuries'
  const countryPreview = stats.countryNames.join(' · ')

  return (
    <motion.div
      className="documentary-welcome"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.22, 0.8, 0.2, 1] }}
    >
      <div className="documentary-welcome__backdrop" aria-hidden="true">
        <div className="documentary-welcome__grain" />
        <div className="documentary-welcome__vignette" />
      </div>

      <div className="documentary-welcome__content">
        <p className="documentary-welcome__eyebrow">Family Atlas</p>
        <h1 className="documentary-welcome__title">
          Your family&apos;s story spans over {centurySpan} {centuryLabel}.
        </h1>
        <p className="documentary-welcome__subtitle">
          Our historian has prepared a guided journey through {stats.generations} generations,{' '}
          {stats.documentedMembers} documented lives, and the migrations that carried your family
          across {stats.migrations} crossings and {stats.countries} countries.
        </p>

        <dl className="documentary-welcome__stats">
          <div>
            <dt>Years represented</dt>
            <dd>
              {stats.earliestYear}–Present
            </dd>
          </div>
          <div>
            <dt>Historical eras</dt>
            <dd>{stats.historicalEras} eras across {stats.yearSpan} years</dd>
          </div>
          <div>
            <dt>Places touched</dt>
            <dd>{countryPreview}</dd>
          </div>
        </dl>

        <div className="documentary-welcome__actions">
          <button type="button" className="documentary-welcome__primary" onClick={beginDocumentary}>
            Begin Documentary
          </button>
          <button type="button" className="documentary-welcome__secondary" onClick={skipToAtlas}>
            Skip to Atlas
          </button>
        </div>

        <p className="documentary-welcome__duration">
          Cinematic opening · {formatDocumentaryDuration(totalDurationMs)} · sit back and watch
        </p>
      </div>
    </motion.div>
  )
}
