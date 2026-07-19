import type { LineagePalette } from '../../utils/lineageColors'
import { lineageLegendItems } from '../../utils/lineageColors'

type MapLineageLegendProps = {
  palette: LineagePalette
  visible?: boolean
}

export function MapLineageLegend({ palette, visible = true }: MapLineageLegendProps) {
  if (!visible) return null

  const items = lineageLegendItems(palette)

  return (
    <div className="map-lineage-legend" aria-label="Migration line colors">
      <div className="map-lineage-legend-title">Migration lines</div>
      <ul className="map-lineage-legend-list">
        {items.map((item) => (
          <li key={item.side} className="map-lineage-legend-item">
            <span
              className="map-lineage-legend-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
