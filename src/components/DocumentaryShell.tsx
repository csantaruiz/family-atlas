import { AnimatePresence } from 'framer-motion'
import { useDocumentaryMode } from '../context/DocumentaryModeContext'
import { DocumentaryWelcome } from './documentary/DocumentaryWelcome'
import { DocumentaryControls } from './documentary/DocumentaryControls'
import { DocumentaryTheater } from './documentary/DocumentaryTheater'
import { DocumentaryEnding } from './documentary/DocumentaryEnding'

function AtlasOrientationCaption() {
  const { showsAtlas, currentScene, narrationVisible } = useDocumentaryMode()
  if (!showsAtlas || !currentScene?.narration || !narrationVisible) return null

  return (
    <div className="film-atlas-caption" aria-live="polite">
      <p className="film-atlas-caption__text">{currentScene.narration}</p>
    </div>
  )
}

export function DocumentaryShell() {
  const { phase } = useDocumentaryMode()

  return (
    <>
      <AnimatePresence>
        {phase === 'welcome' ? <DocumentaryWelcome key="welcome" /> : null}
      </AnimatePresence>
      <DocumentaryTheater />
      <AtlasOrientationCaption />
      <DocumentaryControls />
      <AnimatePresence>
        {phase === 'ending' ? <DocumentaryEnding key="ending" /> : null}
      </AnimatePresence>
      {phase === 'transition' ? (
        <div className="documentary-transition documentary-transition--atlas" aria-hidden="true">
          <div className="documentary-transition__fade" />
        </div>
      ) : null}
    </>
  )
}
