import { Globe, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function TimelineControls() {
  const [historyEnabled, setHistoryEnabled] = useState(true)

  return (
    <div
      aria-label="Timeline controls"
      className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8"
    >
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          role="switch"
          aria-checked={historyEnabled}
          onClick={() => setHistoryEnabled((value) => !value)}
          className="flex items-center gap-2.5"
        >
          <Globe className="size-3.5 text-atlas-teal-soft" strokeWidth={1.5} aria-hidden="true" />
          <span className="control-chip">History</span>
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              historyEnabled ? 'bg-atlas-teal-dim' : 'bg-atlas-border'
            }`}
            aria-hidden="true"
          >
            <span
              className={`inline-block size-2.5 rounded-full bg-atlas-teal transition-transform ${
                historyEnabled ? 'translate-x-3.5' : 'translate-x-1'
              }`}
            />
          </span>
        </button>

        <button type="button" className="control-chip flex items-center gap-1.5">
          <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          Return to Craig
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[0.6875rem] tracking-wide text-atlas-text-muted">
          Centuries
        </span>
        <div className="zoom-track relative flex items-center" aria-hidden="true">
          <div className="zoom-thumb absolute left-1/3 -translate-x-1/2" />
        </div>
        <span className="text-[0.6875rem] tracking-wide text-atlas-text-muted">Years</span>
      </div>
    </div>
  )
}
