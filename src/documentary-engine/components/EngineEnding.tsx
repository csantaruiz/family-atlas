import { useDocumentaryEngine } from '../context/DocumentaryEngineContext'

export function EngineEnding({
  exiting = false,
  visible = true,
}: {
  exiting?: boolean
  visible?: boolean
}) {
  const { exploreAtlas, durationMs } = useDocumentaryEngine()

  return (
    <div
      className={[
        'documentary-ending',
        'de-ending',
        visible ? 'de-ending--visible' : 'de-ending--enter',
        exiting ? 'de-ending--exit' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="documentary-ending__backdrop" aria-hidden="true" />
      <div className="documentary-ending__content">
        <p className="documentary-welcome__eyebrow">Documentary complete</p>
        <h2 className="documentary-welcome__title">Enter the Atlas</h2>
        <p className="documentary-welcome__subtitle">
          You have traveled {Math.round(durationMs / 60000)} minutes through your family&apos;s
          history. The interactive Atlas awaits — explore every generation at your own pace.
        </p>
        <button type="button" className="documentary-ending__cta" onClick={exploreAtlas}>
          Explore the Atlas
        </button>
      </div>
    </div>
  )
}
