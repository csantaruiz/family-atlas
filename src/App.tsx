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
import { useAtlasPageTransition } from './hooks/useAtlasPageTransition'
import type { AppView } from './types/navigation'
import type { CSSProperties, ReactNode } from 'react'

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

function AppShell() {
  const { activeView } = useAppNavigation()

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

function App() {
  return (
    <TimelineProvider>
      <AppNavigationProvider>
        <JourneyIntroProvider>
          <AppShell />
        </JourneyIntroProvider>
      </AppNavigationProvider>
    </TimelineProvider>
  )
}

export default App
