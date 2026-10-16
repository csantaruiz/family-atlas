import {
  formatEngineTime,
  useDocumentaryEngine,
} from '../context/DocumentaryEngineContext'

function geographyArc(countryNames: readonly string[]): string {
  const names = countryNames.filter(Boolean)
  if (names.length === 0) return 'places recorded in your family archive'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} to ${names[1]}`
  return `${names[0]} to ${names[names.length - 1]}`
}

export function EngineWelcome({ exiting = false }: { exiting?: boolean }) {
  const { stats, durationMs, begin, exploreAtlas } = useDocumentaryEngine()

  const centurySpan = Math.max(1, Math.ceil(stats.yearSpan / 100))
  const centuryLabel = centurySpan === 1 ? 'century' : 'centuries'
  const countryPreview = stats.countryNames.join(' · ')
  const arc = geographyArc(stats.countryNames)

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
          An interactive archive connecting ancestors, historical events, and geographic journeys
          — from {arc}. A narrated documentary ({formatEngineTime(durationMs)}) is available when you
          prefer a guided telling.
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
          <button type="button" className="documentary-welcome__primary" onClick={exploreAtlas}>
            Explore Our Family Story
          </button>
          <button type="button" className="documentary-welcome__secondary" onClick={begin}>
            Begin Documentary
          </button>
        </div>
      </div>
    </div>
  )
}
