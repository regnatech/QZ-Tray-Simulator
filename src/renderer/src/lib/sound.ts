/** Synthesised printer sounds via the Web Audio API (no asset files needed). */
let ctx: AudioContext | null = null

function audio(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as never)['webkitAudioContext'])()
  return ctx
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'square', gain = 0.06): void {
  try {
    const ac = audio()
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g).connect(ac.destination)
    const now = ac.currentTime
    osc.start(now)
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
    osc.stop(now + durationMs / 1000)
  } catch {
    /* audio not available */
  }
}

export function playBeep(): void {
  tone(880, 120, 'square')
}

export function playDrawer(): void {
  // A short two-tone "cha-ching" reminiscent of a cash drawer.
  tone(660, 80, 'triangle', 0.08)
  setTimeout(() => tone(990, 160, 'triangle', 0.08), 90)
}

export function playCut(): void {
  tone(220, 60, 'sawtooth', 0.04)
  setTimeout(() => tone(180, 90, 'sawtooth', 0.04), 60)
}
