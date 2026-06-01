import { create } from 'zustand'
import type { AppSettings, ProductId, SlimeVrLiveState } from '@shared/types'
import { createTranslator, type Locale, type TranslationKey } from '../i18n'

interface AppState {
  settings: AppSettings | null
  locale: Locale
  selectedProduct: ProductId | null
  liveState: SlimeVrLiveState
  updateStatus: string | null
  appVersion: string
  /** User confirmed the receiver is plugged into the extension cable. */
  cableAcknowledged: boolean

  t: (key: TranslationKey, vars?: Record<string, string | number>) => string

  init: () => Promise<void>
  setLocale: (locale: Locale) => void
  selectProduct: (id: ProductId) => void
  setLiveState: (state: SlimeVrLiveState) => void
  setUpdateStatus: (status: string) => void
  setCableAcknowledged: (value: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  locale: 'en',
  selectedProduct: null,
  liveState: { connected: false, trackers: [] },
  updateStatus: null,
  appVersion: '',
  cableAcknowledged: false,

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
  setCableAcknowledged: (cableAcknowledged) => set({ cableAcknowledged })
}))
