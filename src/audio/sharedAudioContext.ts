type AudioContextCtor = typeof AudioContext

let shared: AudioContext | null = null

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  )
}

export function isWebAudioSupported(): boolean {
  return audioContextCtor() != null
}

/** One context for the whole app — iOS caps concurrent contexts and each needs its own unlock. */
export function getSharedAudioContext(): AudioContext | null {
  if (shared) return shared
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  shared = new Ctor()
  return shared
}

/** Must run synchronously inside a user gesture; iOS only unlocks from the gesture stack. */
export function resumeSharedAudioContext(): void {
  const ctx = getSharedAudioContext()
  if (ctx && ctx.state !== 'running') {
    void ctx.resume().catch(() => {
      // Retried on the next gesture.
    })
  }
}
