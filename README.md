# VYRO VR Configurator

A Windows desktop app that guides VYRO VR customers through setting up their **IBIS**
full-body trackers — a step-by-step wizard that checks their PC, detects the USB receiver
and SlimeVR Server, shows live tracker status, helps with firmware, and links out to docs
and support.

The app **complements** [SlimeVR Server](https://slimevr.dev) (which does the actual
tracking) — it does not replace it.

## Wizard steps

1. **Welcome** – pick your set (IBIS Core / Advanced / Full Body).
2. **System requirements** – Windows version, x64, RAM, admin rights.
3. **Required software** – detects SteamVR and SlimeVR Server, with install links.
4. **Connect receiver** – live USB detection of the nRF dongle.
5. **Power on trackers** – live battery / signal / firmware via SlimeVR Server's WebSocket.
6. **Mounting & assignment** – guidance + offline-cached docs.
7. **Calibration** – button reference and reset walkthrough.
8. **Firmware** – recommended version from `vyro-vr/firmware` releases, guided manual update,
   plus an opt-in **advanced auto-flash** (gated behind a soft-brick warning).
9. **SteamVR integration** – verifies the SlimeVR OpenVR driver is registered.
10. **Finish** – links (docs, firmware, Discord, store) + one-click diagnostics export.

## Tech stack

- **Electron + React + TypeScript + Vite** (via `electron-vite`)
- **Tailwind CSS** for styling, **Zustand** for state
- **electron-builder** for packaging (NSIS installer + portable), **electron-updater** for
  auto-update against this repo's GitHub Releases
- **Vitest** for unit tests

## Project layout

```
src/
  main/        Electron main process + detection services (system, steamvr, slimevr, usb, firmware, docs, diagnostics)
  preload/     contextBridge — exposes a typed window.api
  renderer/    React UI (wizard steps, components, store, i18n)
  shared/      config.ts (single source of truth) + shared types
resources/docs-cache/  offline doc fallbacks
```

`src/shared/config.ts` is the **single place** to update hardware IDs, bootloader drive
labels, the firmware repo, button mappings, and all external links — no app-logic changes
needed.

## Development

```bash
npm install
npm run dev          # launch the app with hot reload
npm test             # unit tests
npm run lint         # eslint
npm run typecheck    # tsc (node + web projects)
```

## Building

```bash
npm run build:win    # produce the Windows NSIS installer + portable build in release/
```

Code signing is optional but recommended (avoids Windows SmartScreen warnings). Provide
`CSC_LINK` and `CSC_KEY_PASSWORD` to the release workflow.

## Known TODOs (need real hardware / assets)

- Confirm the receiver dongle **VID/PID** and bootloader **volume labels** in `config.ts`.
- Wire full **SolarXR (flatbuffers)** decoding in `services/slimevr.ts` (currently a thin
  read-only client; JSON frames are decoded for now).
- Publish `github.com/vyro-vr/firmware` releases (the firmware step degrades gracefully
  until then).
- Verify the **button-press mapping** against final docs.
- Add `build/icon.ico` and a real Discord invite.
