import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useDocumentaryEngine } from '../context/DocumentaryEngineContext'
import {
  DOCUMENTARY_ENTER_ATLAS_IN_MS,
  DOCUMENTARY_ENTER_ATLAS_OUT_MS,
  DOCUMENTARY_ENTER_ATLAS_REVEAL_DELAY_MS,
  DOCUMENTARY_ENTER_PLAYBACK_BLACK_MS,
  DOCUMENTARY_ENTER_PLAYBACK_IN_MS,
  DOCUMENTARY_ENTER_PLAYBACK_OUT_MS,
  DOCUMENTARY_UI_FADE_MS,
} from '../data/playbackConfig'
import { DocumentaryViewport } from './DocumentaryViewport'
import { EngineControls } from './EngineControls'
import { EngineWelcome } from './EngineWelcome'
import { EngineEnding } from './EngineEnding'
import { GeographicQaView } from './dev/GeographicQaView'
import '../styles/documentary-engine.css'

function isGeoQaMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('geo-qa') === '1'
}

export function DocumentaryEngineRoot() {
  const { phase, transition, atlasHandoff } = useDocumentaryEngine()
  const playbackRevealedRef = useRef(false)
  const [endingVisible, setEndingVisible] = useState(false)
  const [atlasExiting, setAtlasExiting] = useState(false)

  // Prefetch Journey layers while the welcome screen is up.
  useEffect(() => {
    void import('../../components/FamilyLayer')
    void import('../../components/WorldHistoryLayer')
    void import('../../components/FeaturedStory')
    void import('../../components/AtlasThinkingPanel')
    void import('../../components/AtlasMapBackdropInner')
  }, [])

  useEffect(() => {
    if (phase !== 'ending') {
      setEndingVisible(false)
      return
    }
    const frame = requestAnimationFrame(() => setEndingVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [phase])

  useEffect(() => {
    if (transition !== 'enter-atlas') {
      setAtlasExiting(false)
      return
    }
    // Start welcome/ending fade on the next frame so the browser registers the opacity transition.
    const frame = requestAnimationFrame(() => setAtlasExiting(true))
    return () => cancelAnimationFrame(frame)
  }, [transition])

  if (isGeoQaMode()) {
    return (
      <div className="de-root">
        <GeographicQaView />
      </div>
    )
  }

  const welcomeVisible = phase === 'welcome' || transition === 'enter-playback'
  const playbackVisible =
    phase === 'playing' ||
    transition === 'enter-playback' ||
    transition === 'enter-ending'
  if (playbackVisible && transition !== 'enter-playback') {
    playbackRevealedRef.current = true
  }
  const exiting = transition === 'enter-playback' || atlasExiting
  const playbackExiting = transition === 'enter-ending' || transition === 'enter-atlas'
  const rootStyle: CSSProperties =
    transition === 'enter-playback'
      ? {
          ['--de-welcome-fade-out-ms' as string]: `${DOCUMENTARY_ENTER_PLAYBACK_OUT_MS}ms`,
          ['--de-playback-fade-in-delay-ms' as string]: `${
            DOCUMENTARY_ENTER_PLAYBACK_OUT_MS + DOCUMENTARY_ENTER_PLAYBACK_BLACK_MS
          }ms`,
          ['--de-playback-fade-in-ms' as string]: `${DOCUMENTARY_ENTER_PLAYBACK_IN_MS}ms`,
        }
      : transition === 'enter-atlas'
        ? {
            ['--de-atlas-fade-out-ms' as string]: `${DOCUMENTARY_ENTER_ATLAS_OUT_MS}ms`,
            ['--de-atlas-fade-in-ms' as string]: `${DOCUMENTARY_ENTER_ATLAS_IN_MS}ms`,
            ['--de-atlas-reveal-delay-ms' as string]: `${DOCUMENTARY_ENTER_ATLAS_REVEAL_DELAY_MS}ms`,
            ['--de-ui-fade-ms' as string]: `${DOCUMENTARY_UI_FADE_MS}ms`,
          }
        : {
            ['--de-ui-fade-ms' as string]: `${DOCUMENTARY_UI_FADE_MS}ms`,
          }

  return (
    <div
      className={[
        'de-root',
        transition === 'enter-playback' ? 'de-root--enter-playback' : '',
        transition === 'enter-atlas' ? 'de-root--enter-atlas' : '',
        atlasHandoff ? 'de-root--atlas-handoff' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
    >
      <div
        className={[
          'de-playback-layer',
          playbackRevealedRef.current ? 'de-playback-layer--revealed' : '',
          playbackVisible ? 'de-playback-layer--visible' : '',
          transition === 'enter-playback' ? 'de-playback-layer--entering' : '',
          playbackExiting ? 'de-playback-layer--exit' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {phase === 'playing' || transition === 'enter-ending' ? (
          <>
            <DocumentaryViewport />
            {phase === 'playing' ? <EngineControls /> : null}
          </>
        ) : null}
      </div>

      {welcomeVisible ? <EngineWelcome exiting={exiting} /> : null}

      {phase === 'ending' ? (
        <EngineEnding exiting={atlasExiting} visible={endingVisible} />
      ) : null}
    </div>
  )
}
