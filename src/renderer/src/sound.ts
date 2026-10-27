import type { FlashOutcome } from '@shared/flash-outcome'
import successUrl from './assets/sounds/success.mp3'
import wilhelmUrl from './assets/sounds/wilhelm-scream.ogg'

/**
 * Flash result sounds: a short success jingle and the Wilhelm scream on
 * failure. Every call is best-effort — an audio hiccup must never break a
 * flash flow — and honours the persisted `flashSounds` setting.
 */

const SUCCESS_VOLUME = 0.7
const SCREAM_VOLUME = 0.6

let enabled = true
let loaded = false
let success: HTMLAudioElement | null = null
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

function play(audio: HTMLAudioElement, volume: number): void {
  audio.volume = volume
  audio.currentTime = 0
  // play() rejects when autoplay is refused or there is no output device.
  audio.play().catch(() => undefined)
}

/** Plays the sound for a finished flash. Never throws. */
export async function playFlashOutcome(outcome: FlashOutcome): Promise<void> {
  try {
    await ensureLoaded()
    if (!enabled) return
    if (outcome === 'success') play((success ??= new Audio(successUrl)), SUCCESS_VOLUME)
    else play((scream ??= new Audio(wilhelmUrl)), SCREAM_VOLUME)
  } catch {
    // no audio device / autoplay refused — silent is fine
  }
}
