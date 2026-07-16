import { TimelineProvider } from './context/TimelineContext'
import { DetailPanel } from './components/DetailPanel'
import { Header } from './components/Header'
import { TimelineViewport } from './components/TimelineViewport'

function App() {
  return (
    <TimelineProvider>
      <div className="app">
        <div className="grain" aria-hidden="true" />
        <Header />
        <main className="main">
          <TimelineViewport />
        </main>
        <DetailPanel />
      </div>
    </TimelineProvider>
  )
}

export default App
