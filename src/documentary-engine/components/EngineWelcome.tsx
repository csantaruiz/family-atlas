import {
  formatEngineTime,
  useDocumentaryEngine,
} from '../context/DocumentaryEngineContext'

export function EngineWelcome({ exiting = false }: { exiting?: boolean }) {
  const { stats, durationMs, begin, exploreAtlas } = useDocumentaryEngine()

  const centurySpan = Math.max(1, Math.ceil(stats.yearSpan / 100))
  const centuryLabel = centurySpan === 1 ? 'century' : 'centuries'
  const countryPreview = stats.countryNames.join(' · ')

  return (
    <div
      className={[
        'documentary-welcome',
        'de-welcome',
        exiting ? 'de-welcome--exit' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
          A cinematic journey narrated over {formatEngineTime(durationMs)} — from Cheshire to
          California.
        </p>

        <dl className="documentary-welcome__stats">
          <div>
            <dt>Years represented</dt>
            <dd>
              {stats.earliestYear}–Present
            </dd>
          </div>
          <div>
            <dt>Documented lives</dt>
            <dd>{stats.documentedMembers}</dd>
          </div>
          <div>
            <dt>Places touched</dt>
            <dd>{countryPreview}</dd>
          </div>
        </dl>

        <div className="documentary-welcome__actions">
          <button type="button" className="documentary-welcome__primary" onClick={begin}>
            Begin Documentary
          </button>
          <button type="button" className="documentary-welcome__secondary" onClick={exploreAtlas}>
            Explore the Atlas
          </button>
        </div>
      </div>
    </div>
  )
}
