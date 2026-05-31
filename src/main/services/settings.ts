import Store from 'electron-store'
import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  locale: 'en',
  selectedProduct: null,
  telemetryEnabled: false,
  completedFirstRun: false
}

const store = new Store<AppSettings>({ name: 'settings', defaults })

export function getSettings(): AppSettings {
  return {
    locale: store.get('locale'),
    selectedProduct: store.get('selectedProduct'),
    telemetryEnabled: store.get('telemetryEnabled'),
    completedFirstRun: store.get('completedFirstRun')
  }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(patch)) {
    store.set(key, value as never)
  }
  return getSettings()
}
