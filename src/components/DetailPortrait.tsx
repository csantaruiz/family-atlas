import type { PersonImage } from '../types'

type DetailPortraitProps = {
  image?: PersonImage | null
  initials?: string
  useArchivalPlaceholder?: boolean
}

export function DetailPortrait({ image, initials, useArchivalPlaceholder }: DetailPortraitProps) {
  if (image?.src && (useArchivalPlaceholder || image.isPlaceholder)) {
    return (
      <figure className="detail-portrait detail-portrait--placeholder">
        <img className="detail-portrait-img" src={image.src} alt={image.alt} />
        <figcaption className="detail-portrait-caption">
          {image.caption ?? 'Archival portrait placeholder'}
        </figcaption>
        {image.credit && <p className="detail-portrait-credit">{image.credit}</p>}
      </figure>
    )
  }

  if (image?.src) {
    return (
      <figure className="detail-portrait">
        <img className="detail-portrait-img" src={image.src} alt={image.alt} />
        {image.caption && <figcaption className="detail-portrait-caption">{image.caption}</figcaption>}
        {image.credit && <p className="detail-portrait-credit">{image.credit}</p>}
      </figure>
    )
  }

  return (
    <div className="portrait portrait--initials">
      <div className="initials" id="initials">
        {initials}
      </div>
    </div>
  )
}
