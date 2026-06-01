export const en = {
  'app.title': 'VYRO VR Configurator',
  'app.subtitle': 'Get your IBIS trackers set up in minutes.',

  'nav.back': 'Back',
  'nav.next': 'Next',
  'nav.recheck': 'Re-check',
  'nav.finish': 'Finish',
  'nav.skip': 'Skip for now',

  'status.pass': 'Ready',
  'status.warn': 'Attention',
  'status.fail': 'Action needed',
  'status.running': 'Checking…',
  'status.pending': 'Not checked',

  'step.welcome.title': 'Welcome',
  'step.welcome.body': 'Select your tracker set to tailor the setup steps.',
  'step.welcome.trackers': '{count} trackers',

  'step.system.title': 'System Requirements',
  'step.system.os': 'Operating system',
  'step.system.arch': 'Architecture',
  'step.system.memory': 'Memory',
  'step.system.admin': 'Administrator rights',

  'step.software.title': 'Required Software',
  'step.software.steamvr': 'SteamVR',
  'step.software.slimevr': 'SlimeVR Server',
  'step.software.install': 'Install',
  'step.software.getslimevr': 'Get SlimeVR',
  'step.software.installed': 'Installed',
  'step.software.missing': 'Not found',
  'step.software.running': 'Running',
  'step.software.notrunning': 'Not found or not running',
  'step.software.slimevr.hint':
    'Install and launch SlimeVR Server (Steam or standalone) before continuing.',

  'step.receiver.title': 'Connect the Receiver',
  'step.receiver.body': 'Connect the receiver and place it above your play space.',
  'step.receiver.cable.title': 'Use the USB extension cable.',
  'step.receiver.cable.body':
    'Always plug the receiver into the included extension cable, then into your PC — never directly into the case. This is required for reliable tracking.',
  'step.receiver.detected': 'Receiver',
  'step.receiver.notdetected': "Couldn't auto-detect a receiver",
  'step.receiver.notdetected.hint':
    "Receivers vary (foxDongle, Nordic dongle, and others), so we can't always recognise yours. If your trackers show up in SlimeVR Server, your receiver is working fine — continue to the next step.",

  'step.trackers.title': 'Power On Your Trackers',
  'step.trackers.body': 'Press each tracker once to turn it on. They should appear below.',
  'step.trackers.online': '{online} of {expected} trackers online',
  'step.trackers.waiting': 'Waiting for SlimeVR Server…',

  'step.mounting.title': 'Mounting & Assignment',
  'step.calibration.title': 'Calibration',
  'step.calibration.buttons': 'Button reference',
  'step.calibration.docs': 'Open smol-slime docs',

  'step.firmware.title': 'Firmware',
  'step.firmware.recommended': 'Recommended version',
  'step.firmware.notconfigured': 'Firmware updates are not available yet.',
  'step.firmware.guided': 'Guided update',
  'step.firmware.advanced': 'Advanced: Auto-flash',
  'step.firmware.warning':
    'Firmware updates can soft-brick a tracker. Only update if you are told to, and never disconnect mid-flash.',
  'step.firmware.flash': 'Flash to {drive}',
  'step.firmware.nodrive': 'No tracker in DFU mode detected. Press the button 5 times to enter DFU.',

  'step.steamvr.title': 'SteamVR Integration',
  'step.steamvr.driver': 'SlimeVR SteamVR driver',
  'step.steamvr.registered': 'Driver registered',
  'step.steamvr.missing': 'Driver not registered',

  'step.finish.title': 'All Set!',
  'step.finish.body': 'You are ready for full-body tracking. Helpful links below.',
  'step.finish.diagnostics': 'Export diagnostics',
  'step.finish.diagnostics.hint': 'Save a report to share with support or on Discord.',

  'links.docs': 'Documentation',
  'links.firmware': 'Firmware repo',
  'links.discord': 'Discord community',
  'links.store': 'Store',

  // Home / launcher
  'home.title': 'What would you like to do?',
  'home.subtitle': 'Pick a task — we’ll walk you through it step by step.',
  'home.pair.title': 'Pair New Trackers',
  'home.pair.body': 'Connect a tracker to your receiver in a few clicks.',
  'home.calibrate.title': 'Calibrate Trackers',
  'home.calibrate.body': 'Get accurate tracking with a quick calibration.',
  'home.troubleshoot.title': 'Troubleshoot Connection Issues',
  'home.troubleshoot.body': 'Check your setup and fix common problems.',
  'home.fullsetup': 'Open the full setup guide',
  'nav.home': 'Home',

  // Pairing flow
  'pair.title': 'Pair New Trackers',
  'pair.connect.title': 'Connecting to your receiver',
  'pair.connect.searching': 'Looking for your receiver…',
  'pair.connect.found': 'Receiver found',
  'pair.connect.choose': 'More than one receiver found — pick the one to pair to:',
  'pair.connect.none.title': 'No receiver found',
  'pair.connect.none.body':
    'Plug the receiver into your PC using the included USB extension cable, then try again.',
  'pair.connect.retry': 'Search again',
  'pair.connect.use': 'Use this receiver',
  'pair.firmware.note':
    'Tip: trackers and the receiver must be on the same firmware version, or they won’t pair.',
  'pair.listen.title': 'Put your tracker in pairing mode',
  'pair.listen.instruction':
    'Press the tracker’s button {presses} times. The LED will flash blue once per second.',
  'pair.listen.waiting': 'Listening for a tracker…',
  'pair.listen.timeout':
    'Still nothing. Make sure the LED is flashing blue once per second, then press the button {presses} times again.',
  'pair.paired.title': 'New tracker paired! 🎉',
  'pair.paired.count': '{count} paired this session',
  'pair.paired.another': 'Pair another',
  'pair.done': 'Done',
  'pair.error.title': 'Something went wrong',

  // Calibrate flow
  'calibrate.title': 'Calibrate Trackers',
  'calibrate.intro':
    'Lay each tracker flat and still, then press its button twice — the LED cycles through rainbow colours until it finishes. After that, stand in an I-pose and run a full reset in SlimeVR Server.',
  'calibrate.buttons': 'Button reference',

  // Troubleshoot flow
  'troubleshoot.title': 'Troubleshoot Connection Issues',
  'troubleshoot.intro': 'A quick check of the usual suspects.',
  'troubleshoot.receiver': 'Receiver connected',
  'troubleshoot.receiver.fail': 'No receiver detected — plug it in via the USB extension cable.',
  'troubleshoot.server': 'SlimeVR Server',
  'troubleshoot.server.fail': 'Not connected — launch SlimeVR Server, then re-check.',
  'troubleshoot.trackers': 'Trackers online',
  'troubleshoot.trackers.fail':
    'No trackers seen yet — power them on, or pair them with “Pair New Trackers”.',
  'troubleshoot.recheck': 'Re-check'
}
