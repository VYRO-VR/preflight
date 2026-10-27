import type { FlashOutcome } from '@shared/flash-outcome'
import wilhelmUrl from './assets/sounds/wilhelm-scream.ogg'

/**
 * Flash result sounds: a soft two-note chime on success (synthesised, no
 * asset) and the Wilhelm scream on failure. Every call is best-effort — an
 * audio hiccup must never break a flash flow — and honours the persisted
 * `flashSounds` setting.
 */

const CHIME_VOLUME = 0.07
const SCREAM_VOLUME = 0.6

let enabled = true
let loaded = false
let ctx: AudioContext | null = null
let scream: HTMLAudioElement | null = null

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    enabled = (await window.api.settings.get()).flashSounds
  } catch {
    // keep the default
  }
}

export async function flashSoundsEnabled(): Promise<boolean> {
  await ensureLoaded()
  return enabled
}

export async function setFlashSoundsEnabled(value: boolean): Promise<void> {
  loaded = true
  enabled = value
  await window.api.settings.set({ flashSounds: value })
}

function chime(): void {
  ctx ??= new AudioContext()
  const start = ctx.currentTime + 0.01
  // A rising major third (E5 → G#5), each note a short sine with a fast
  // attack and exponential decay so it stays gentle.
  ;[659.25, 830.61].forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    const t0 = start + i * 0.12
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(CHIME_VOLUME, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(t0)
    osc.stop(t0 + 0.5)
  })
}

function wilhelm(): void {
  scream ??= new Audio(wilhelmUrl)
  scream.volume = SCREAM_VOLUME
  scream.currentTime = 0
  void scream.play()
}

/** Plays the sound for a finished flash. Never throws. */
export async function playFlashOutcome(outcome: FlashOutcome): Promise<void> {
  try {
    await ensureLoaded()
    if (!enabled) return
    if (outcome === 'success') chime()
    else wilhelm()
  } catch {
    // no audio device / autoplay refused — silent is fine
  }
}
