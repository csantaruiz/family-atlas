import { AppNavigationProvider } from './context/AppNavigationContext'
import { JourneyIntroProvider } from './context/JourneyIntroContext'
import { TimelineProvider } from './context/TimelineContext'
import { DetailPanel } from './components/DetailPanel'
import { AtlasMapBackdrop } from './components/AtlasMapBackdrop'
import { Header } from './components/Header'
import { TimelineViewport } from './components/TimelineViewport'
import { AboutView } from './components/views/AboutView'
import { MapView } from './components/views/MapView'
import { PeopleView } from './components/views/PeopleView'
import { TreeView } from './components/views/TreeView'
import { useAppNavigation } from './context/AppNavigationContext'
import { usePreventBrowserZoom } from './hooks/usePreventBrowserZoom'
import { useAtlasPageTransition } from './hooks/useAtlasPageTransition'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DOCUMENTARY_ENTER_ATLAS_IN_MS } from './documentary-engine/data/playbackConfig'
import {
  DocumentaryEngineProvider,
  DocumentaryEngineRoot,
  useDocumentaryEngine,
} from './documentary-engine'
import type { AppView } from './types/navigation'
import { DocumentaryV3Player } from './documentary-v3'

const VIEW_RENDERERS: Record<AppView, (active: boolean) => ReactNode> = {
  journey: (active) => <TimelineViewport active={active} />,
  people: (active) => <PeopleView active={active} />,
  tree: (active) => <TreeView active={active} />,
  map: (active) => <MapView active={active} />,
  about: (active) => <AboutView active={active} />,
}

function AppViews() {
  const { activeView } = useAppNavigation()
  const { layers, transitionMs, views } = useAtlasPageTransition(activeView)
  const stageStyle: CSSProperties = {
    ['--atlas-page-transition-ms' as string]: `${transitionMs}ms`,
  }

  return (
    <main className="main view-stage" style={stageStyle}>
      {views.map((view) => {
        const layer = layers[view]
        if (!layer) return null
        const layerStyle: CSSProperties = {
          opacity: layer.opacity,
          visibility: layer.present ? 'visible' : 'hidden',
          pointerEvents: layer.interactive ? 'auto' : 'none',
          zIndex: layer.stack,
          ['--layer-blur' as string]: `${layer.blur}px`,
        }
        return (
          <div
            key={view}
            className="view-transition-layer"
            style={layerStyle}
            aria-hidden={!layer.interactive}
          >
            {VIEW_RENDERERS[view](layer.interactive)}
          </div>
        )
      })}
    </main>
  )
}

function AtlasAppShell() {
  const { activeView } = useAppNavigation()
  usePreventBrowserZoom()

  return (
    <div className={`app app--view-${activeView}`}>
      <AtlasMapBackdrop />
      <div className="grain" aria-hidden="true" />
      <Header />
      <AppViews />
      <DetailPanel />
    </div>
  )
}

function AppGate() {
  const { phase, transition } = useDocumentaryEngine()
  const [atlasVisible, setAtlasVisible] = useState(false)

  // Never dual-mount Atlas during enter-atlas — mounting it blocks the fade for seconds.
  const showDocumentary = phase !== 'complete'
  const showAtlas = phase === 'complete'
  const showBlackout = transition === 'enter-atlas' || (showAtlas && !atlasVisible)

  useEffect(() => {
    if (!showAtlas) {
      setAtlasVisible(false)
      return
    }
    // One frame at opacity 0, then fade in — keeps the CSS transition reliable.
    const frame = requestAnimationFrame(() => setAtlasVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [showAtlas])

  const atlasEntryStyle: CSSProperties = {
    ['--atlas-entry-fade-ms' as string]: `${DOCUMENTARY_ENTER_ATLAS_IN_MS}ms`,
    ['--atlas-entry-fade-delay-ms' as string]: '0ms',
  }

  return (
    <>
      {showAtlas ? (
        <div
          className={['atlas-entry', atlasVisible ? 'atlas-entry--visible' : '']
            .filter(Boolean)
            .join(' ')}
          style={atlasEntryStyle}
        >
          <AtlasAppShell />
        </div>
      ) : null}
      {showDocumentary ? <DocumentaryEngineRoot /> : null}
      {showBlackout ? <div className="atlas-blackout" aria-hidden="true" /> : null}
    </>
  )
}

function App() {
  if (window.location.pathname === '/documentary-v3') {
    return <DocumentaryV3Player />
  }

  return (
    <TimelineProvider>
      <AppNavigationProvider>
        <JourneyIntroProvider>
          <DocumentaryEngineProvider>
            <AppGate />
          </DocumentaryEngineProvider>
        </JourneyIntroProvider>
      </AppNavigationProvider>
    </TimelineProvider>
  )
}

export default App
