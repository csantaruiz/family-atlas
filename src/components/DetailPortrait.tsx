import { useEffect, useState } from 'react'
import type { PersonImage } from '../types'

type DetailPortraitProps = {
  image?: PersonImage | null
  initials?: string
  useArchivalPlaceholder?: boolean
  variant?: 'portrait' | 'history-hero'
}

export function DetailPortrait({
  image,
  initials,
  useArchivalPlaceholder,
  variant = 'portrait',
}: DetailPortraitProps) {
  const isHistoryHero = variant === 'history-hero'
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [image?.src])

  if (image?.src && !imageFailed && (useArchivalPlaceholder || image.isPlaceholder)) {
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

  if (image?.src && !imageFailed) {
    return (
      <figure className={`detail-portrait${isHistoryHero ? ' detail-portrait--history-hero' : ''}`}>
        <img
          className={`detail-portrait-img${isHistoryHero ? ' detail-portrait-img--history-hero' : ''}`}
          src={image.src}
          alt={image.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
        {image.caption && (
          <figcaption className="detail-portrait-caption">{image.caption}</figcaption>
        )}
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
