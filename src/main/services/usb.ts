import { exec } from 'child_process'
import { promisify } from 'util'
import { RECEIVER_USB_IDS } from '@shared/config'
import type { UsbDeviceMatch } from '@shared/types'

const execAsync = promisify(exec)

/**
 * Detect the VYRO receiver dongle. On Windows we query PnP devices via
 * PowerShell/WMI and match the configured VID/PID list — this needs no native
 * module and works on a stock machine. A COM port is reported when the device
 * exposes a serial (CDC) interface.
 */
export async function detectReceiver(): Promise<UsbDeviceMatch> {
  if (process.platform !== 'win32') {
    return { detected: false, description: 'USB detection is only implemented on Windows.' }
  }

  let pnpJson: string
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-PnpDevice -PresentOnly | ' +
        'Select-Object FriendlyName, InstanceId, Class | ConvertTo-Json -Compress"',
      { windowsHide: true, maxBuffer: 1024 * 1024 * 8 }
    )
    pnpJson = stdout
  } catch {
    return { detected: false, description: 'Unable to query USB devices.' }
  }

  let devices: { FriendlyName?: string; InstanceId?: string; Class?: string }[]
  try {
    const parsed = JSON.parse(pnpJson)
    devices = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return { detected: false, description: 'Could not parse device list.' }
  }

  for (const id of RECEIVER_USB_IDS) {
    const needle = `VID_${id.vendorId.toUpperCase()}&PID_${id.productId.toUpperCase()}`
    const hit = devices.find((d) => d.InstanceId?.toUpperCase().includes(needle))
    if (hit) {
      const comPort = extractComPort(hit.FriendlyName)
      return {
        detected: true,
        description: hit.FriendlyName || id.label,
        vendorId: id.vendorId,
        productId: id.productId,
        comPort
      }
    }
  }

  return { detected: false, description: 'No VYRO receiver detected on any USB port.' }
}

function extractComPort(friendlyName?: string): string | undefined {
  const m = friendlyName?.match(/\((COM\d+)\)/i)
  return m?.[1]
}
