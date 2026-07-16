type DetailPanelProps = {
  isOpen?: boolean
}

export function DetailPanel({ isOpen = false }: DetailPanelProps) {
  if (!isOpen) return null

  return (
    <aside
      aria-label="Detail panel"
      className="detail-panel-shell fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col px-6 py-8 md:px-8"
    >
      <header className="border-b border-atlas-border pb-4">
        <p className="text-[0.6875rem] tracking-[0.08em] text-atlas-gold-dim uppercase">
          Detail
        </p>
        <h2 className="font-serif mt-2 text-2xl font-medium text-atlas-gold">
          Panel title
        </h2>
      </header>

      <div className="mt-6 flex-1">
        <p className="text-sm leading-relaxed text-atlas-text">
          Detail content will appear here without displacing timeline context.
        </p>
      </div>
    </aside>
  )
}
