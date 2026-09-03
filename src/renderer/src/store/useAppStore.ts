import { create } from 'zustand'
import type { AppSettings, ProductId, SlimeVrLiveState } from '@shared/types'
import { createTranslator, type Locale, type TranslationKey } from '../i18n'

/**
 * Renderer-side mirror of the receiver's pairing mode. `busy` covers the gap
 * while a start/stop request is in flight so the indicator can't be
 * double-clicked into an inconsistent state.
 */
export interface PairingUiState {
  active: boolean
  busy: boolean
  /** Serial path in use, or the last one used. */
  path: string | null
  /** Last failure from a start/stop attempt, cleared on the next one. */
  error: string | null
}

interface AppState {
  settings: AppSettings | null
  locale: Locale
  selectedProduct: ProductId | null
  liveState: SlimeVrLiveState
  updateStatus: string | null
  appVersion: string
  /** User confirmed the receiver is plugged into the extension cable. */
  cableAcknowledged: boolean
  /** Whether the receiver is being held in pairing mode, app-wide. */
  pairing: PairingUiState

  t: (key: TranslationKey, vars?: Record<string, string | number>) => string

  init: () => Promise<void>
  setLocale: (locale: Locale) => void
  selectProduct: (id: ProductId) => void
  setLiveState: (state: SlimeVrLiveState) => void
  setUpdateStatus: (status: string) => void
  setCableAcknowledged: (value: boolean) => void
  /** Put the receiver on `path` into pairing mode. */
  startPairing: (path: string) => Promise<void>
  /** Take the receiver out of pairing mode. */
  stopPairing: () => Promise<void>
  /** Dismiss the last pairing failure. */
  clearPairingError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  locale: 'en',
  selectedProduct: null,
  liveState: { connected: false, trackers: [] },
  updateStatus: null,
  appVersion: '',
  cableAcknowledged: false,
  pairing: { active: false, busy: false, path: null, error: null },

  t: createTranslator('en'),

  init: async () => {
    const [settings, appVersion] = await Promise.all([
      window.api.settings.get(),
      window.api.app.getVersion()
    ])
    const locale = (settings.locale as Locale) || 'en'
    set({
      settings,
      locale,
      selectedProduct: settings.selectedProduct,
      appVersion,
      t: createTranslator(locale)
    })

    // Stream live tracker state and update notifications.
    window.api.slimevr.onLiveState((state) => get().setLiveState(state))
    window.api.app.onUpdateStatus((status) => get().setUpdateStatus(status))
    window.api.slimevr.connect()

    // Mirror pairing mode app-wide. Pairing can be started from the global
    // indicator or from inside the pairing flow, so the store follows the
    // main process's status events rather than any one view's local state.
    window.api.receiver.onPairingEvent((event) => {
      if (event.type === 'status') {
        set((s) => ({
          pairing: { ...s.pairing, active: event.status === 'listening' }
        }))
      } else if (event.type === 'error') {
        set((s) => ({ pairing: { ...s.pairing, error: event.message } }))
      }
    })
    set({ pairing: { ...get().pairing, ...(await window.api.receiver.getPairingState()) } })
  },

  setLocale: (locale) => {
    set({ locale, t: createTranslator(locale) })
    window.api.settings.set({ locale })
  },

  selectProduct: (id) => {
    set({ selectedProduct: id })
    window.api.settings.set({ selectedProduct: id })
  },

  setLiveState: (liveState) => set({ liveState }),
  setUpdateStatus: (updateStatus) => set({ updateStatus }),
  setCableAcknowledged: (cableAcknowledged) => set({ cableAcknowledged }),

  startPairing: async (path) => {
    set((s) => ({ pairing: { ...s.pairing, busy: true, error: null, path } }))
    try {
      await window.api.receiver.startPairing(path)
      set((s) => ({ pairing: { ...s.pairing, active: true } }))
    } catch (e) {
      set((s) => ({
        pairing: { ...s.pairing, active: false, error: e instanceof Error ? e.message : String(e) }
      }))
    } finally {
      set((s) => ({ pairing: { ...s.pairing, busy: false } }))
    }
  },

  stopPairing: async () => {
    set((s) => ({ pairing: { ...s.pairing, busy: true, error: null } }))
    try {
      await window.api.receiver.stopPairing()
    } catch (e) {
      set((s) => ({ pairing: { ...s.pairing, error: e instanceof Error ? e.message : String(e) } }))
    } finally {
      set((s) => ({ pairing: { ...s.pairing, active: false, busy: false } }))
    }
  },

  clearPairingError: () => set((s) => ({ pairing: { ...s.pairing, error: null } }))
}))
