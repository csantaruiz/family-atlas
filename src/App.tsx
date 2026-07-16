import { AppNavigationProvider } from './context/AppNavigationContext'
import { JourneyIntroProvider } from './context/JourneyIntroContext'
import { TimelineProvider } from './context/TimelineContext'
import { DetailPanel } from './components/DetailPanel'
import { Header } from './components/Header'
import { TimelineViewport } from './components/TimelineViewport'
import { AboutView } from './components/views/AboutView'
import { MapView } from './components/views/MapView'
import { PeopleView } from './components/views/PeopleView'
import { useAppNavigation } from './context/AppNavigationContext'

function AppViews() {
  const { activeView } = useAppNavigation()

  return (
    <main className="main">
      <TimelineViewport active={activeView === 'journey'} />
      <PeopleView active={activeView === 'people'} />
      <MapView active={activeView === 'map'} />
      <AboutView active={activeView === 'about'} />
    </main>
  )
}

function App() {
  return (
    <TimelineProvider>
      <AppNavigationProvider>
        <JourneyIntroProvider>
          <div className="app">
            <div className="grain" aria-hidden="true" />
            <Header />
            <AppViews />
            <DetailPanel />
          </div>
        </JourneyIntroProvider>
      </AppNavigationProvider>
    </TimelineProvider>
  )
}

export default App
