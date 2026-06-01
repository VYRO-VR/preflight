import type { ComponentType } from 'react'
import type { TranslationKey } from '../i18n'
import { WelcomeStep } from './WelcomeStep'
import { SystemStep } from './SystemStep'
import { SoftwareStep } from './SoftwareStep'
import { ReceiverStep } from './ReceiverStep'
import { TrackersStep } from './TrackersStep'
import { MountingStep } from './MountingStep'
import { CalibrationStep } from './CalibrationStep'
import { FirmwareStep } from './FirmwareStep'
import { SteamVrStep } from './SteamVrStep'
import { FinishStep } from './FinishStep'

export interface WizardStep {
  id: string
  titleKey: TranslationKey
  Component: ComponentType
}

export const STEPS: WizardStep[] = [
  { id: 'welcome', titleKey: 'step.welcome.title', Component: WelcomeStep },
  { id: 'system', titleKey: 'step.system.title', Component: SystemStep },
  { id: 'software', titleKey: 'step.software.title', Component: SoftwareStep },
  { id: 'receiver', titleKey: 'step.receiver.title', Component: ReceiverStep },
  { id: 'trackers', titleKey: 'step.trackers.title', Component: TrackersStep },
  { id: 'mounting', titleKey: 'step.mounting.title', Component: MountingStep },
  { id: 'calibration', titleKey: 'step.calibration.title', Component: CalibrationStep },
  { id: 'firmware', titleKey: 'step.firmware.title', Component: FirmwareStep },
  { id: 'steamvr', titleKey: 'step.steamvr.title', Component: SteamVrStep },
  { id: 'finish', titleKey: 'step.finish.title', Component: FinishStep }
]
