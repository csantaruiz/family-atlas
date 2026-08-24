import { useEffect, useRef, useState } from 'react'
import { useFamilyData } from '../family-data/FamilyDataProvider'
import { useAtlasReview } from '../atlas-review/AtlasReviewRoot'
import { fetchEditStatus, ensureEditAccess } from '../utils/mediaApi'
import {
  manageCopy,
  canShowEditorSignIn,
  canShowManageEntry,
} from './customerCopy'
import { customerPreviewFromInspect, type CustomerChangePreview } from './customerPreview'
import type { InspectableGedcomImport } from '../gedcom/import/inspectImport'
import {
  activateGedcomImport,
  discardGedcomImport,
  loadGedcomImport,
  uploadGedcomFile,
} from './gedcomManageApi'

type Screen =
  | 'closed'
  | 'home'
  | 'checking'
  | 'preview'
  | 'identity'
  | 'confirm'
  | 'complete'
  | 'error'
  | 'duplicate'

type Props = {
  open: boolean
  onClose: () => void
  fetchFn?: typeof fetch
}

export function ManageFamilyTree({ open, onClose, fetchFn = fetch }: Props) {
  const family = useFamilyData()
  const review = useAtlasReview()
  const fileRef = useRef<HTMLInputElement>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [stage, setStage] = useState(0)
  const [inspect, setInspect] = useState<InspectableGedcomImport | null>(null)
  const [preview, setPreview] = useState<CustomerChangePreview | null>(null)
  const [activateCalls, setActivateCalls] = useState(0)
  const [livePaused, setLivePaused] = useState(false)
  const currentPeople = family.database.stats.people

  useEffect(() => {
    if (!open) {
      setScreen('home')
      setInspect(null)
      setPreview(null)
      setStage(0)
      setActivateCalls(0)
      setLivePaused(false)
    }
  }, [open])

  useEffect(() => {
    if (screen !== 'checking') return
    const timer = window.setInterval(() => {
      setStage((n) => (n + 1) % manageCopy.stages.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [screen])

  if (!open) return null

  const showPreview = (row: InspectableGedcomImport) => {
    const next = customerPreviewFromInspect(row, currentPeople)
    setInspect(row)
    setPreview(next)
    setScreen(next.needsHelp > 0 ? 'identity' : 'preview')
  }

  const onChooseFile = async (file: File) => {
    setScreen('checking')
    setStage(0)
    setLivePaused(false)
    try {
      const result = await uploadGedcomFile(file, fetchFn)
      if (result.duplicateImportId) {
        const existing = await loadGedcomImport(result.duplicateImportId, fetchFn)
        if (existing) {
          setInspect(existing)
          setPreview(customerPreviewFromInspect(existing, currentPeople))
        }
        setScreen('duplicate')
        return
      }
      if (!result.inspect || result.inspect.status === 'failed') {
        setScreen('error')
        return
      }
      showPreview(result.inspect)
    } catch {
      setScreen('error')
    }
  }

  const onDiscard = async () => {
    if (inspect) await discardGedcomImport(inspect.id, fetchFn)
    setInspect(null)
    setPreview(null)
    setScreen('home')
  }

  const onActivate = async () => {
    if (!inspect || !preview?.canUpdate) return
    setActivateCalls((n) => n + 1)
    const result = await activateGedcomImport(inspect.id, fetchFn)
    if (!result.ok) {
      setLivePaused(Boolean(result.livePaused))
      setScreen('error')
      return
    }
    await family.reload()
    setScreen('complete')
  }

  return (
    <div className="atlas-manage-scrim" role="dialog" aria-modal="true" aria-labelledby="atlas-manage-title">
      <div className="atlas-manage-sheet">
        {screen === 'home' || screen === 'checking' ? (
          <>
            <p className="atlas-manage-kicker">Family editor</p>
            <h2 id="atlas-manage-title">{manageCopy.title}</h2>
            <h3>{manageCopy.currentHeading}</h3>
            <p className="atlas-manage-stat">{manageCopy.peopleLine(currentPeople)}</p>
            <h3>{manageCopy.updateHeading}</h3>
            <p>{manageCopy.uploadLead}</p>
            <p className="atlas-manage-muted">{manageCopy.reassurance}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".ged,.GED"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void onChooseFile(file)
              }}
            />
            <div className="atlas-manage-actions">
              <button type="button" className="atlas-manage-primary" onClick={() => fileRef.current?.click()}>
                {manageCopy.chooseFile}
              </button>
              <button type="button" onClick={onClose}>
                {manageCopy.returnToAtlas}
              </button>
            </div>
            {screen === 'checking' ? (
              <>
                <p className="atlas-manage-progress" aria-live="polite">
                  {manageCopy.checking} {manageCopy.stages[stage]}
                </p>
                <p className="atlas-manage-banner">{manageCopy.checkingUnchanged}</p>
              </>
            ) : null}
          </>
        ) : null}

        {screen === 'preview' && preview ? (
          <>
            <p className="atlas-manage-kicker">Family editor</p>
            <h2 id="atlas-manage-title">{manageCopy.previewHeading}</h2>
            <p className="atlas-manage-banner">{manageCopy.notAppliedYet}</p>
            <h3>{manageCopy.familyHeading}</h3>
            <p>
              {preview.currentPeople} → {preview.candidatePeople} people
            </p>
            <ul className="atlas-manage-list">
              {preview.exactMatches > 0 ? <li>{manageCopy.matched(preview.exactMatches)}</li> : null}
              {preview.added > 0 ? <li>{manageCopy.added(preview.added)}</li> : null}
              {preview.noLongerInFile > 0 ? <li>{manageCopy.noLongerInFile(preview.noLongerInFile)}</li> : null}
              {preview.updated > 0 ? <li>{manageCopy.updated(preview.updated)}</li> : null}
            </ul>
            {preview.noLongerInFile > 0 ? <p className="atlas-manage-muted">{manageCopy.noLongerNote}</p> : null}
            <h3>{manageCopy.atlasHeading}</h3>
            <ul className="atlas-manage-list">
              <li>✓ {manageCopy.photosKept(preview.photosKept)}</li>
              <li>✓ {manageCopy.storiesKept(preview.storiesKept)}</li>
              {preview.filmKept > 0 ? <li>✓ {manageCopy.filmKept(preview.filmKept)}</li> : null}
              <li>✓ {manageCopy.placesKept}</li>
            </ul>
            {preview.needsHelp > 0 ? (
              <p>
                ⚠ {manageCopy.needsHelp(preview.needsHelp)}{' '}
                <button type="button" onClick={() => setScreen('identity')}>
                  {manageCopy.review}
                </button>
              </p>
            ) : null}
            <div className="atlas-manage-actions">
              <button
                type="button"
                className="atlas-manage-primary"
                disabled={!preview.canUpdate}
                onClick={() => setScreen('confirm')}
              >
                {manageCopy.updateAtlas}
              </button>
              <button type="button" onClick={() => void onDiscard()}>
                {manageCopy.discard}
              </button>
            </div>
          </>
        ) : null}

        {screen === 'identity' && preview ? (
          <>
            <h2 id="atlas-manage-title">{manageCopy.identityTitle}</h2>
            <p className="atlas-manage-banner">{manageCopy.notAppliedYet}</p>
            <p>{manageCopy.identityLead}</p>
            {preview.identityQuestions.map((question, index) => (
              <div key={`${question.currentName}-${index}`} className="atlas-manage-card">
                <p>
                  <strong>{question.currentName}</strong>
                  {question.currentLife ? ` · ${question.currentLife}` : ''}
                </p>
                <p>
                  <strong>{question.candidateName}</strong>
                  {question.candidateLife ? ` · ${question.candidateLife}` : ''}
                </p>
                <div className="atlas-manage-actions">
                  <button type="button">{manageCopy.yesSame}</button>
                  <button type="button">{manageCopy.noDifferent}</button>
                  <button type="button">{manageCopy.notSure}</button>
                </div>
              </div>
            ))}
            <p className="atlas-manage-muted">{manageCopy.identityPending}</p>
            <div className="atlas-manage-actions">
              <button type="button" onClick={() => setScreen('preview')}>
                {manageCopy.cancel}
              </button>
            </div>
          </>
        ) : null}

        {screen === 'confirm' ? (
          <>
            <h2 id="atlas-manage-title">{manageCopy.confirmTitle}</h2>
            <p className="atlas-manage-banner">{manageCopy.notAppliedYet}</p>
            <p>{manageCopy.confirmBody}</p>
            <div className="atlas-manage-actions">
              <button type="button" className="atlas-manage-primary" onClick={() => void onActivate()}>
                {manageCopy.confirmAction}
              </button>
              <button type="button" onClick={() => setScreen('preview')}>
                {manageCopy.cancel}
              </button>
            </div>
            <span data-activate-calls={activateCalls} hidden />
          </>
        ) : null}

        {screen === 'complete' && preview ? (
          <>
            <h2 id="atlas-manage-title">{manageCopy.completeTitle}</h2>
            <p className="atlas-manage-stat">{manageCopy.peopleLine(preview.candidatePeople)}</p>
            <ul className="atlas-manage-list">
              {preview.added > 0 ? <li>{manageCopy.added(preview.added)}</li> : null}
              {preview.noLongerInFile > 0 ? <li>{manageCopy.noLongerInFile(preview.noLongerInFile)}</li> : null}
              <li>✓ {manageCopy.photosKept(preview.photosKept)}</li>
              <li>✓ {manageCopy.storiesKept(preview.storiesKept)}</li>
            </ul>
            {review.count > 0 ? (
              <p>
                {manageCopy.completeReview(review.count)}{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    review.openReview()
                  }}
                >
                  {manageCopy.reviewAtlas}
                </button>
              </p>
            ) : null}
            <div className="atlas-manage-actions">
              <button type="button" className="atlas-manage-primary" onClick={onClose}>
                {manageCopy.returnToAtlas}
              </button>
            </div>
          </>
        ) : null}

        {screen === 'error' ? (
          <>
            <h2 id="atlas-manage-title">{manageCopy.failTitle}</h2>
            <p>{livePaused ? manageCopy.failLiveBody : manageCopy.failBody}</p>
            <div className="atlas-manage-actions">
              <button type="button" className="atlas-manage-primary" onClick={() => setScreen('home')}>
                {manageCopy.retry}
              </button>
              <button type="button" onClick={onClose}>
                {manageCopy.returnToAtlas}
              </button>
            </div>
          </>
        ) : null}

        {screen === 'duplicate' ? (
          <>
            <h2 id="atlas-manage-title">{manageCopy.duplicateTitle}</h2>
            <p className="atlas-manage-banner">{manageCopy.notAppliedYet}</p>
            <p>{manageCopy.duplicateBody}</p>
            <div className="atlas-manage-actions">
              <button
                type="button"
                className="atlas-manage-primary"
                onClick={() => setScreen(preview?.needsHelp ? 'identity' : 'preview')}
              >
                {manageCopy.review}
              </button>
              <button type="button" onClick={() => setScreen('home')}>
                {manageCopy.chooseFile}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function AboutManageEntry({ onOpen }: { onOpen: () => void }) {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    void fetchEditStatus().then(setEditing)
  }, [])

  if (canShowManageEntry(editing)) {
    return (
      <button type="button" className="atlas-manage-entry" onClick={onOpen}>
        {manageCopy.manageEntry}
      </button>
    )
  }
  if (canShowEditorSignIn(editing)) {
    return (
      <button
        type="button"
        className="atlas-manage-entry"
        onClick={() => {
          void ensureEditAccess()
            .then(() => fetchEditStatus())
            .then((ok) => {
              if (ok) {
                setEditing(true)
                onOpen()
              }
            })
            .catch(() => undefined)
        }}
      >
        {manageCopy.editorSignIn}
      </button>
    )
  }
  return null
}
