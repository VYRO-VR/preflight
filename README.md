# VYRO VR Preflight

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
8. **Firmware** – pick your board + build options in a dropdown and the app resolves the exact
   file from the SlimeNRF CI's rolling `latest` release; guided manual update plus an opt-in
   **advanced auto-flash** (gated behind a soft-brick warning).
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
npm run build:win    # Windows NSIS installer + portable (.exe)        → release/
npm run build:mac    # macOS .dmg + .zip (x64 + arm64)                 → release/
npm run build:linux  # Linux AppImage + .deb (x64)                     → release/
```

Each platform must be packaged on its own OS (electron-builder can't, for example, build a
macOS `.dmg` from Linux). CI handles this with a per-OS matrix:

- **Release** (`release.yml`, on `v*` tag push) and **Release on merge** (`release-on-merge.yml`)
  build and publish all three platforms to the same GitHub Release.
- **Build installers** (`installer.yml`, on `claude/**` pushes or manual dispatch) uploads the
  installers as downloadable workflow artifacts without publishing a release.

Code signing is optional but recommended. Provide `CSC_LINK` + `CSC_KEY_PASSWORD` for Windows
(avoids SmartScreen) and macOS signing; add `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` +
`APPLE_TEAM_ID` to notarize the macOS build (avoids Gatekeeper warnings). Unsigned builds work
everywhere — macOS just needs a right-click → **Open** the first time.

> **Platform note:** the cross-platform builds run today, but the deeper hardware-detection
> steps (USB receiver enumeration, Windows-version checks, drive-letter firmware flashing) are
> currently Windows-only and degrade gracefully on macOS/Linux. The wizard, docs, live SlimeVR
> feed, and UF2 firmware path work cross-platform.

## SlimeVR live feed

`services/solarxr.ts` implements the **SolarXR (flatbuffers)** data feed: it sends a
`StartDataFeed` request and decodes `DataFeedUpdate` frames into per-tracker battery, signal
(RSSI), firmware version, body part, and status. The bindings come from the
`solarxr-protocol` GitHub package (built on install). The codec has a roundtrip unit test, but
should still be **validated against a running SlimeVR Server**, since that can't be done in CI.

## Known TODOs (need real hardware / assets)

- Confirm the receiver dongle **VID/PID** and bootloader **volume labels** in `config.ts`
  (detection is best-effort; receivers vary, e.g. foxDongle).
- Validate the live tracker feed against a real SlimeVR Server (especially the battery scale).
- Firmware comes from the SlimeNRF CI's `latest` release (`FIRMWARE_REPO` in `config.ts`). Board
  detection from the reported firmware string is best-effort — confirm which board/build options
  VYRO's IBIS trackers ship so the right default is pre-selected.
