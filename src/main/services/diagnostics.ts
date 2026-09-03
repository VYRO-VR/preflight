import { promises as fs } from 'fs'
import { app, dialog } from 'electron'
import { getSystemInfo } from './system'
import { getSteamVrInfo } from './steamvr'
import { getSlimeVrInstall } from './slimevr'
import { detectReceiver } from './usb'
import { getFirmwareCatalog } from './firmware'
import type { DiagnosticsResult, SlimeVrLiveState } from '@shared/types'

/**
 * Build a support report users can attach in Discord / a support ticket.
 * Collects environment + detected versions + the current live tracker state.
 * Saved as a single JSON file via a save dialog (no archiver dependency).
 */
export async function exportDiagnostics(liveState: SlimeVrLiveState): Promise<DiagnosticsResult> {
  const [system, steamvr, slimevr, usb, firmware] = await Promise.all([
    getSystemInfo(),
    getSteamVrInfo(),
    getSlimeVrInstall(),
    detectReceiver(),
    getFirmwareCatalog()
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    system,
    steamvr,
    slimevr,
    usbReceiver: usb,
    firmware: {
      source: firmware.source,
      configured: firmware.configured,
      recommended: firmware.recommended?.tag,
      error: firmware.error
    },
    liveTrackers: liveState
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export diagnostics',
    defaultPath: `vyro-diagnostics-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })

  if (canceled || !filePath) {
    return { ok: false, message: 'Export cancelled.' }
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8')
    return { ok: true, filePath, message: 'Diagnostics saved.' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to write file.' }
  }
}
