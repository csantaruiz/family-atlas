import { useEffect, useId, useRef, useState } from 'react'
import type { PersonImage } from '../types'
import {
  createPortraitFromFile,
  removePersonPortrait,
  setPersonPortrait,
} from '../utils/personPortraitStore'

type DetailPortraitProps = {
  image?: PersonImage | null
  initials?: string
  useArchivalPlaceholder?: boolean
  variant?: 'portrait' | 'history-hero'
  /** When set with a person name, placeholder portraits can accept uploads. */
  personId?: string
  personName?: string
}

function downloadPortraitForRepo(personId: string, src: string) {
  const link = document.createElement('a')
  link.href = src
  link.download = `${personId}.jpg`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function DetailPortrait({
  image,
  initials,
  useArchivalPlaceholder,
  variant = 'portrait',
  personId,
  personName,
}: DetailPortraitProps) {
  const isHistoryHero = variant === 'history-hero'
  const [imageFailed, setImageFailed] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    setImageFailed(false)
    setUploadError(null)
  }, [image?.src, personId])

  const canUpload = Boolean(personId && personName && !isHistoryHero)
  const isUserUpload = Boolean(image?.isUserUpload)
  const isUnavailable =
    !image?.src || Boolean(useArchivalPlaceholder || image.isPlaceholder) || imageFailed
  const showUploadChrome = canUpload && (isUnavailable || isUserUpload)

  const handleFile = async (file: File | undefined) => {
    if (!file || !personId || !personName) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const portrait = await createPortraitFromFile(file, personName)
      setPersonPortrait(personId, portrait)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const uploadControl = showUploadChrome ? (
    <div className="detail-portrait-upload">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="detail-portrait-upload-input"
        disabled={isUploading}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="detail-portrait-upload-actions">
        <label
          htmlFor={inputId}
          className={`detail-portrait-upload-btn${isUploading ? ' is-busy' : ''}`}
        >
          {isUploading ? 'Uploading…' : isUserUpload ? 'Replace photo' : 'Upload photo'}
        </label>
        {isUserUpload && image?.src && personId ? (
          <button
            type="button"
            className="detail-portrait-upload-btn"
            disabled={isUploading}
            onClick={() => downloadPortraitForRepo(personId, image.src)}
          >
            Download for repo
          </button>
        ) : null}
        {isUserUpload ? (
          <button
            type="button"
            className="detail-portrait-upload-btn detail-portrait-upload-btn--ghost"
            disabled={isUploading}
            onClick={() => {
              if (!personId) return
              removePersonPortrait(personId)
              setUploadError(null)
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {isUserUpload ? (
        <p className="detail-portrait-upload-hint">
          Local only until you add <code>{personId}.jpg</code> to{' '}
          <code>src/assets/portraits/people/</code> and push to GitHub.
        </p>
      ) : null}
      {uploadError ? <p className="detail-portrait-upload-error">{uploadError}</p> : null}
    </div>
  ) : null

  if (image?.src && !imageFailed && (useArchivalPlaceholder || image.isPlaceholder)) {
    return (
      <figure className="detail-portrait detail-portrait--placeholder">
        <img className="detail-portrait-img" src={image.src} alt={image.alt} />
        <figcaption className="detail-portrait-caption">
          {image.caption ?? 'Portrait unavailable'}
        </figcaption>
        {image.credit && !canUpload ? (
          <p className="detail-portrait-credit">{image.credit}</p>
        ) : null}
        {uploadControl}
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
        {uploadControl}
      </figure>
    )
  }

  return (
    <div className="portrait portrait--initials detail-portrait--initials-wrap">
      <div className="initials" id="initials">
        {initials}
      </div>
      {uploadControl}
    </div>
  )
}
