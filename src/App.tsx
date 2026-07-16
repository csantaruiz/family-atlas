import { DetailPanel } from './components/DetailPanel'
import { Header } from './components/Header'
import { HighlightCarousel } from './components/HighlightCarousel'
import { TimelineControls } from './components/TimelineControls'
import { TimelineViewport } from './components/TimelineViewport'

function App() {
  return (
    <div className="museum-shell relative flex min-h-svh flex-col">
      <Header />

      <main className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col">
        <div className="pointer-events-none absolute top-5 left-5 z-10 md:top-6 md:left-8">
          <div className="pointer-events-auto">
            <HighlightCarousel />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center pt-44 pb-24 md:pt-48 md:pb-28">
          <TimelineViewport />
        </div>

        <div className="mt-auto">
          <TimelineControls />
        </div>
      </main>

      <DetailPanel isOpen={false} />
    </div>
  )
}

export default App
