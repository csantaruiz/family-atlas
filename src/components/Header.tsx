import { useState } from 'react'

const NAV_ITEMS = ['Journey', 'People', 'Places', 'About'] as const

const ARCHIVE_STATS = [
  { value: '325', label: 'People' },
  { value: '80', label: 'Families' },
  { value: '21', label: 'Generations' },
] as const

function AtlasEmblem() {
  return (
    <div className="atlas-emblem" aria-hidden="true">
      <div className="atlas-emblem__inner" />
    </div>
  )
}

export function Header() {
  const [activeNav] = useState<(typeof NAV_ITEMS)[number]>('Journey')

  return (
    <header className="border-b border-atlas-border px-5 py-3 md:px-8 md:py-4">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 md:items-center md:gap-4">
          <AtlasEmblem />
          <div className="min-w-0">
            <h1 className="font-serif text-lg leading-tight font-medium tracking-wide text-atlas-gold md:text-xl">
              Santa Ruiz Family Atlas
            </h1>
            <p className="mt-0.5 text-xs tracking-wide text-atlas-text-muted md:text-sm">
              Every life leaves a trail.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-10">
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {ARCHIVE_STATS.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1.5">
                <dt className="stat-label">{stat.label}</dt>
                <dd className="stat-value">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <nav aria-label="Primary" className="flex flex-wrap gap-4 md:gap-6">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className={`nav-link ${item === activeNav ? 'nav-link--active' : ''}`}
                aria-current={item === activeNav ? 'page' : undefined}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
