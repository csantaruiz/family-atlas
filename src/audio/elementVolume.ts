import { getSharedAudioContext } from './sharedAudioContext'

/** Dev/QA switch to exercise the iOS gain path on desktop browsers. */
const FORCE_GAIN_KEY = 'atlas-audio-force-gain'

let settableCache: boolean | null = null

/** iOS Safari ignores writes to `HTMLMediaElement.volume` (it always reads back 1). */
export function isElementVolumeSettable(): boolean {
  if (settableCache != null) return settableCache
  try {
    if (localStorage.getItem(FORCE_GAIN_KEY) === '1') {
      settableCache = false
      return settableCache
    }
  } catch {
    // Storage unavailable — fall through to the probe.
  }
  try {
    const probe = document.createElement('audio')
    probe.volume = 0.5
    settableCache = Math.abs(probe.volume - 0.5) < 0.01
  } catch {
    settableCache = true
  }
  return settableCache
}

export type VolumeControl = {
  /** True when the element is routed through Web Audio (context must be resumed in a gesture). */
  readonly routed: boolean
  get(): number
  set(volume: number): void
}

const routedGains = new WeakMap<HTMLMediaElement, GainNode>()

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Volume for a media element that also works on iOS.
 * Where element volume is honoured this is a thin wrapper; otherwise the element is
 * permanently routed through a gain node on the shared audio context.
 */
export function createVolumeControl(element: HTMLMediaElement): VolumeControl {
  const ctx = isElementVolumeSettable() ? null : getSharedAudioContext()
  if (!ctx) {
    return {
      routed: false,
      get: () => element.volume,
      set: (volume) => {
        element.volume = clamp01(volume)
      },
    }
  }

  let gain = routedGains.get(element)
  if (!gain) {
    const source = ctx.createMediaElementSource(element)
    gain = ctx.createGain()
    source.connect(gain).connect(ctx.destination)
    routedGains.set(element, gain)
  }
  const node = gain
  return {
    routed: true,
    get: () => node.gain.value,
    set: (volume) => {
      node.gain.cancelScheduledValues(ctx.currentTime)
      node.gain.value = clamp01(volume)
    },
  }
}
