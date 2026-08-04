import type { SceneManifestEntry } from '../../types/manifest'

type AuthenticEvidenceSceneProps = {
  scene: SceneManifestEntry
  progress: number
}

/** Rare pause on authentic family evidence — map continues underneath. */
export function AuthenticEvidenceScene({ scene, progress }: AuthenticEvidenceSceneProps) {
  const evidence = scene.evidence
  const reveal = Math.min(1, Math.max(0, (progress - 0.12) / 0.28))
  const fade = progress > 0.82 ? (1 - progress) / 0.18 : 1

  if (!evidence) return null

  return (
    <div className="de-evidence-panel de-evidence-panel--authentic" style={{ opacity: reveal * fade }}>
      <p className="de-evidence-label">{evidence.label}</p>
      <h3 className="de-evidence-title">{evidence.title}</h3>
      <ul className="de-evidence-lines">
        {evidence.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
