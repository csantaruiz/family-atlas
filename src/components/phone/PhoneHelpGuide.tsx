import type { ReactNode } from 'react'

function HelpIcon({ children }: { children: ReactNode }) {
  return (
    <span className="phone-help-icon" aria-hidden="true">
      {children}
    </span>
  )
}

function LegendIcon() {
  return (
    <HelpIcon>
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="10" cy="16" r="5" fill="#d6b56c" />
        <rect
          x="18.4"
          y="11.4"
          width="9.2"
          height="9.2"
          rx="1"
          fill="none"
          stroke="#66b7c7"
          strokeWidth="1.8"
          transform="rotate(45 23 16)"
        />
      </svg>
    </HelpIcon>
  )
}

function ZoomIcon() {
  return (
    <HelpIcon>
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="14" cy="14" r="7" />
        <path d="M19.2 19.2 25 25" strokeLinecap="round" />
        <path d="M14 11v6M11 14h6" strokeLinecap="round" />
      </svg>
    </HelpIcon>
  )
}

function PanIcon() {
  return (
    <HelpIcon>
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path
          d="M12 15.5V11a1.6 1.6 0 0 1 3.2 0v3.2M15.2 13.4V10a1.6 1.6 0 0 1 3.2 0v4.2M18.4 14.2v-2.4a1.6 1.6 0 0 1 3.2 0V18c0 3.2-1.8 6-5.4 6.8-2.4.6-5.2-.2-6.6-2.2L8 23"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </HelpIcon>
  )
}

function RecordIcon() {
  return (
    <HelpIcon>
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <rect
          x="11.2"
          y="11.2"
          width="9.6"
          height="9.2"
          rx="1"
          fill="#d6b56c"
          transform="rotate(45 16 16)"
        />
        <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      </svg>
    </HelpIcon>
  )
}

function GroupIcon() {
  return (
    <HelpIcon>
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text
          x="16"
          y="20"
          textAnchor="middle"
          fill="currentColor"
          fontSize="11"
          fontFamily="Georgia, Times New Roman, serif"
        >
          3
        </text>
      </svg>
    </HelpIcon>
  )
}

const ROWS = [
  {
    title: 'Family & history',
    body: 'Gold marks family lives. Teal diamonds mark world history.',
    icon: <LegendIcon />,
  },
  {
    title: 'Zoom',
    body: 'Pinch the canvas, or use + / − on the chapter plaque.',
    icon: <ZoomIcon />,
  },
  {
    title: 'Move through time',
    body: 'Drag left or right to move through years.',
    icon: <PanIcon />,
  },
  {
    title: 'Open a record',
    body: 'Tap a named family event to explore that person, tree position, or journey.',
    icon: <RecordIcon />,
  },
  {
    title: 'Grouped events',
    body: 'A numbered circle is several events close together. Tap it to see the list.',
    icon: <GroupIcon />,
  },
] as const

export function PhoneHelpGuide() {
  return (
    <ul className="phone-help-guide">
      {ROWS.map((row) => (
        <li key={row.title} className="phone-help-row">
          {row.icon}
          <div className="phone-help-copy">
            <strong>{row.title}</strong>
            <p>{row.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
