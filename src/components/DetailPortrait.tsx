import { useEffect, useId, useRef, useState } from 'react'
import type { PersonImage } from '../types'
import {
  reloadPersonPortrait,
  removePersonPortrait,
  uploadPersonPortrait,
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

function downloadPortrait(personId: string, src: string) {
  const link = document.createElement('a')
  link.href = src
  link.download = `${personId}.jpg`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function apiPortraitSrc(image: PersonImage | null | undefined): string | null {
  if (!image?.assetId) return null
  return `/api/media/${image.assetId}`
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
  const [isRetrying, setIsRetrying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    setImageFailed(false)
    setUploadError(null)
  }, [image?.src, personId])

  const canUpload = Boolean(personId && personName && !isHistoryHero)
  const isUserUpload = Boolean(image?.isUserUpload)
  const previewSrc =
    image?.src?.startsWith('blob:') && !image.loadError
      ? image.src
      : apiPortraitSrc(image) ?? image?.src ?? null
  const previewFailed = isUserUpload && Boolean(previewSrc) && (imageFailed || Boolean(image?.loadError))
  const previewError = image?.loadError ?? (imageFailed ? 'Portrait preview could not be loaded.' : null)
  const isUnavailable =
    !previewSrc || Boolean(useArchivalPlaceholder || image?.isPlaceholder) || previewFailed
  const showUploadChrome = canUpload && (isUnavailable || isUserUpload)

  const handleRetryPreview = async () => {
    if (!personId) return
    setIsRetrying(true)
    setImageFailed(false)
    setUploadError(null)
    try {
      await reloadPersonPortrait(personId)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Retry failed.')
    } finally {
      setIsRetrying(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || !personId || !personName) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await uploadPersonPortrait(personId, personName, file)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!personId) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await removePersonPortrait(personId)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Remove failed.')
    } finally {
      setIsUploading(false)
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
        disabled={isUploading || isRetrying}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div
        className={`detail-portrait-upload-actions${previewFailed ? ' detail-portrait-upload-actions--wrap' : ''}`}
      >
        <label
          htmlFor={inputId}
          className={`detail-portrait-upload-btn${isUploading ? ' is-busy' : ''}`}
        >
          {isUploading ? 'Uploading…' : isUserUpload ? 'Replace photo' : 'Upload photo'}
        </label>
        {isUserUpload && previewSrc && personId ? (
          <button
            type="button"
            className="detail-portrait-upload-btn"
            disabled={isUploading || isRetrying}
            onClick={() => downloadPortrait(personId, previewSrc)}
          >
            Download
          </button>
        ) : null}
        {isUserUpload && previewFailed ? (
          <button
            type="button"
            className="detail-portrait-upload-btn"
            disabled={isUploading || isRetrying}
            onClick={() => void handleRetryPreview()}
          >
            {isRetrying ? 'Retrying…' : 'Retry preview'}
          </button>
        ) : null}
        {isUserUpload ? (
          <button
            type="button"
            className="detail-portrait-upload-btn detail-portrait-upload-btn--ghost"
            disabled={isUploading || isRetrying}
            onClick={() => void handleRemove()}
          >
            Remove
          </button>
        ) : null}
      </div>
      {previewFailed && previewError ? (
        <p className="detail-portrait-upload-error">{previewError}</p>
      ) : null}
      {uploadError ? <p className="detail-portrait-upload-error">{uploadError}</p> : null}
    </div>
  ) : null

  const overlayCaption =
    image?.caption ??
    (useArchivalPlaceholder || image?.isPlaceholder ? 'Portrait unavailable' : null)
  const portraitOverlay = overlayCaption ? (
      <figcaption className="detail-portrait-overlay">
        <span className="detail-portrait-caption">{overlayCaption}</span>
      </figcaption>
    ) : null

  const portraitFrame = (img: React.ReactNode, extraClass = '') => (
    <div className={`detail-portrait-frame${extraClass ? ` ${extraClass}` : ''}`}>
      {img}
      {portraitOverlay}
    </div>
  )

  if (previewSrc && !previewFailed && (useArchivalPlaceholder || image?.isPlaceholder)) {
    return (
      <figure className="detail-portrait detail-portrait--placeholder">
        {portraitFrame(
          <img className="detail-portrait-img" src={previewSrc} alt={image?.alt ?? ''} />,
        )}
        {uploadControl}
      </figure>
    )
  }

  if (previewSrc && !previewFailed) {
    return (
      <figure className={`detail-portrait${isHistoryHero ? ' detail-portrait--history-hero' : ''}`}>
        {portraitFrame(
          <img
            className={`detail-portrait-img${isHistoryHero ? ' detail-portrait-img--history-hero' : ''}`}
            src={previewSrc}
            alt={image?.alt ?? ''}
            loading={isUserUpload ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setImageFailed(true)}
          />,
        )}
        {uploadControl}
      </figure>
    )
  }

  if (previewSrc && previewFailed) {
    return (
      <figure className="detail-portrait detail-portrait--upload-error">
        <div className="detail-portrait-upload-error-frame">
          <img
            className="detail-portrait-img detail-portrait-img--hidden"
            src={previewSrc}
            alt=""
            aria-hidden="true"
            onError={() => setImageFailed(true)}
          />
          <p className="detail-portrait-upload-error-label">Preview unavailable</p>
        </div>
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
