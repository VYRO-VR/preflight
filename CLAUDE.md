# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VYRO VR Preflight is a Windows-first Electron desktop app that guides customers through setting up VYRO's **IBIS** full-body SlimeVR trackers. It **complements** SlimeVR Server (which does the actual tracking) — it detects the PC/software/receiver, shows a live tracker feed, and helps with pairing, calibration, and firmware. The deeper hardware-detection steps (USB enumeration, Windows-version checks, drive-letter flashing) are Windows-only and degrade gracefully to no-ops on macOS/Linux; the wizard, docs, live feed, and UF2 path work cross-platform.

## Commands

```bash
npm run dev          # launch app with hot reload (electron-vite dev)
npm test             # run unit tests once (vitest run)
npm run test:watch   # vitest watch mode
npx vitest run tests/firmware.test.ts   # run a single test file
npm run lint         # eslint on .ts/.tsx
npm run typecheck    # tsc for BOTH node and web projects (see below)
npm run format       # prettier --write on src
npm run build        # typecheck + electron-vite build (no packaging)
npm run build:win    # NSIS installer + portable .exe  → release/
```

CI (`.github/workflows/ci.yml`) runs `lint → typecheck → test → build` on Ubuntu, so all four must pass. Packaging must happen on each target OS (electron-builder can't cross-build a macOS `.dmg` from Linux).

**Typecheck is two separate projects** — `typecheck:node` (main/preload/shared/tests via `tsconfig.node.json`) and `typecheck:web` (renderer/shared via `tsconfig.web.json`). Both are `strict` with `noUnusedLocals`/`noUnusedParameters`. There is no root project that sees everything, so run `npm run typecheck` (both) before assuming a change compiles.

## Architecture

Standard Electron three-process split with a strict security boundary (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`):

- **`src/main/`** — Node/Electron main process. `index.ts` creates the splash + main windows and wires lifecycle. `ipc.ts` registers every `ipcMain.handle` channel. `services/` holds all the actual work (system/steamvr/slimevr/usb/receiver/firmware/nrfutil/docs/diagnostics/settings detection & I/O).
- **`src/preload/index.ts`** — the ONLY bridge. It builds a typed `Api` object and exposes it as `window.api` via `contextBridge`. Every renderer→main call goes through here.
- **`src/renderer/src/`** — React UI. `App.tsx` is a view switcher between a `HomeScreen` and five flows/wizard (`pair`/`calibrate`/`troubleshoot`/`receiver`/`wizard`). The 10-step wizard is data-driven from `wizard/steps.tsx`. Global state is a single Zustand store (`store/useAppStore.ts`).
- **`src/shared/`** — imported by all three processes via the `@shared/*` alias (configured in `electron.vite.config.ts`, `vitest.config.ts`, and both tsconfigs). `types.ts` defines the `Api` interface and every IPC payload type; `config.ts`, `firmware-naming.ts`, `firmware-match.ts` are pure logic.

### Adding an IPC endpoint

An endpoint touches four files in lockstep — keep them in sync or typecheck fails:
1. `src/shared/types.ts` — add the method to the `Api` interface (+ any payload types).
2. `src/main/ipc.ts` — `ipcMain.handle('channel', ...)` delegating to a service.
3. `src/main/services/*.ts` — the implementation.
4. `src/preload/index.ts` — the `window.api` wrapper calling `ipcRenderer.invoke`.

### Streaming vs request/response

Most channels are request/response (`invoke`/`handle`). Two are **long-lived event streams** pushed from main → renderer: `slimevr:live-state` (tracker feed) and `receiver:pairing-event`. `registerIpc` returns those long-lived clients (`SlimeVrClient`, `ReceiverPairingClient`) so `index.ts`'s `before-quit` can tear them down — critically, `stopPairing()` also takes the receiver *out* of pairing mode, which the renderer's own cleanup can't be relied on to flush during teardown. In the renderer, `store.init()` subscribes via `window.api.*.on...()` callbacks that return an unsubscribe function.

### The SlimeVR live feed (SolarXR)

`services/solarxr.ts` encodes a `StartDataFeed` request and decodes `DataFeedUpdate` frames over SlimeVR Server's WebSocket (`ws://127.0.0.1:21110`), using flatbuffers bindings from the `solarxr-protocol` GitHub dependency (built on `npm install`). Note the data shape: **battery / RSSI / firmware live on the device; body part / status live on each tracker** under that device. The codec has a roundtrip unit test but can only be truly validated against a running SlimeVR Server (not possible in CI).

### Firmware picker

Firmware comes from the GitHub releases of VYRO's firmware repo (`VYRO-VR/Firmware`): the app fetches the releases list, prefers a release whose notes contain `[recommended]`, then the newest stable, then the newest prerelease — and the picker surfaces that release's assets (one asset per board × build-option combo, named `VYRO_VR_*` / `VVR_*` / upstream `SlimeNRF_*`; VYRO names always end in the source-commit hash, which the parser extracts as `parsed.commit`). `shared/firmware-naming.ts` is pure logic that parses each filename by pulling known *option* tokens out (whatever remains is the board name — order-independent and forward-compatible with new boards), then resolves a `FirmwareSelection` to exactly one asset via a weighted `matchScore` (compatibility-critical dimensions like radio protocol weigh most, so a fallback never silently swaps them). Two flash paths: `.uf2` drag-drop onto the bootloader drive (`autoFlash`, Windows-only) and Secure DFU `.zip` via bundled `nrfutil` (`flashReceiverDfu`) for receivers with no UF2 drive.

## `src/shared/config.ts` is the single source of truth

Hardware IDs, bootloader volume labels, the firmware repo, WebSocket URL, button/press mappings, the receiver serial protocol (baud rate, pairing/version/dfu commands, output regexes), doc pages, and every external link live here. Changing hardware, the firmware source, or the pairing protocol should be a **one-file edit** with no app-logic changes. Many values are marked `TODO`/"VERIFY against real hardware" — they are best-effort guesses (receiver VID/PIDs, bootloader labels, serial-console format) pending confirmation against VYRO's actual IBIS trackers and firmware fork.

## i18n

All UI strings go through the Zustand store's `t()` (`i18n/index.ts`). `TranslationKey` is `keyof typeof en`, so **`en.ts` is the schema** — add a key there first or `t('...')` won't typecheck. `pt.ts` mirrors it; missing keys fall back to English then to the raw key. Don't hardcode user-facing strings in components.

## CI note

`installer.yml` builds downloadable installer artifacts (all three OSes) on any `claude/**` branch push, without publishing a release. **Every merge to main auto-bumps the patch version, commits it back, tags it, and publishes a GitHub Release** (`release-on-merge.yml`) — don't bump `package.json`'s version manually in PRs. `v*` tag pushes also publish (`release.yml`).
