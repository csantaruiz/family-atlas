type SceneAtmosphereProps = {
  variant?: 'paper' | 'map' | 'archive' | 'engraving'
}

export function SceneAtmosphere({ variant = 'paper' }: SceneAtmosphereProps) {
  return (
    <div className={`de-atmosphere de-atmosphere--${variant}`} aria-hidden="true">
      <div className="de-atmosphere__texture" />
      <div className="de-atmosphere__vignette-edge" />
      <div className="de-atmosphere__handwriting" />
    </div>
  )
}
