# Phase 1a Implementation Plan — Guided Gyro Sensitivity Calibration (Preflight)

Companion to `yaw-drift-handoff.md`. Scope here is **Preflight only** (Tasks 1–3).
Firmware Task F3 and Phase 2/3 live in the firmware, receiver, and SlimeVR-Server
repos and are tracked separately.

Verified against `VYRO-VR/jitingcn-smol-slime-firmware@2e8f2b4` (dev) and
`VYRO-VR/SlimeVR-Tracker-nRF-Receiver@adfbdab`.

---

## Findings that change the handoff's assumptions

1. **The turn counter is required, not a progress dial.** `cal_sens.c` only accepts a
   stop once `measured >= expected * SENS_CAL_MIN_FRACTION` (0.85) *and* the rate has
   stayed under `SENS_CAL_STOP_RATE_DPS` (10 dps) for `SENS_CAL_STOP_DWELL_MS` (1 s).
   Under-spinning does not produce a bad calibration — it produces a 60-second hang
   ending in "spin did not complete in time". The on-screen counter is the only thing
   telling the user they are not done yet.

2. **Hard time budget — 10 revolutions is the decision, and it is tight.**
   `SENS_CAL_START_TIMEOUT_MS` = 30 s to begin spinning after the command,
   `SENS_CAL_SPIN_TIMEOUT_MS` = 60 s for the whole spin. At 10 revolutions that leaves
   ≤6 s per turn *including* the final careful edge-aligned stop, which needs ~2-3 s of
   the budget — so the spin itself must average nearer 5.5 s/turn. 10 rev buys the
   tighter alignment error floor (±1° over 10 turns = 0.03%, vs 0.06% at 6), well under
   the ~0.5% scale error being removed.
   The flow must actively make that pace achievable rather than just reporting failure:
   - a **pace guide** during the spin (target turn count vs elapsed, e.g. a moving
     "you should be at 4.2 turns by now" marker beside the live counter),
   - a **remaining-time countdown** against the 60 s budget, visibly urgent under ~15 s,
   - a dry-run/practice turn before the real command so the user learns the cadence
     without burning a run,
   - and copy on the timeout failure that says "spin a little faster next time", since
     that is what the firmware's `spin did not complete in time` actually means.
   Ceiling is 100 on both sides (`SENS_CAL_MAX_REVOLUTIONS`, `SENS_AUTO_MAX_REVOLUTIONS`).

3. **A rejection reason the handoff does not list: off-axis motion.**
   `SENS_CAL_MAX_OFF_AXIS_RATIO` = 0.25 rejects the run outright, and 0.10 warns. The
   flow must coach "slide it flat on the surface, do not lift or tilt", and the failure
   copy must name this as a likely cause — it is the most probable failure for a
   hand-turned tracker on X/Y (stood on edge).

4. **Accepted scale is clamped to 0.9–1.1** (`SENS_CAL_MIN_SCALE`/`MAX_SCALE`). Anything
   outside means "wrong turn count", which is exactly what a mis-counted GUI would
   cause. Another reason the counter must be right.

5. **The quaternion feed should stay live during calibration.** `sensor_calibrate_sens()`
   runs on the calibration thread (`calibration.c:604`); it consumes gyro samples through
   the `sensor_wait_gyro` mailbox fed by the still-running sensor thread. Fusion and ESB
   streaming are not suspended (unlike `sensor_set_mag_enabled`, which restarts fusion).
   So the live turn counter and the verification spin are viable. **Confirm on hardware
   before building the UI on top of it** — this is the load-bearing assumption of Task 3.

6. **v1 inference stands; there is no existing host-visible signal.**
   `SYS_STATUS_CALIBRATION_RUNNING` is set around the call but is never transmitted —
   `connection.c` does not encode it. Confirms the handoff's gap analysis and the need
   for Task F3.

7. **The receiver acks the command on its console.** `send <id|all> sens auto <x|y|z> [rev]`
   prints `Sens auto request sent to tracker <id> on <axis> axis for <n> rev` on
   `RCV_HID_ST_QUEUED`, and `Invalid axis '…'` / `Invalid revolutions '…'` on rejection.
   So v1 gets a real send-confirmation even without F3 — only the *result* is inferred.

8. **Identity mapping is the one unsolved problem.** `send <id>` takes a receiver slot id;
   the live feed gives `deviceId:trackerNum` from SolarXR. Nothing links them today.
   - The receiver's `list` prints stored addresses one per line **in slot order**, so
     line index = slot id (`rcv_cmd.c:146`, `printk("%012llX\n", …)`).
   - SlimeVR-Server names HID trackers `Tracker $formattedHWID` (`HIDCommon.kt`).
   - Plan: parse `list`, attempt a substring match of each address against the SolarXR
     tracker name, and **always require the user to confirm via the wiggle test** before
     sending. Never silently assume the mapping — a wrong slot calibrates the wrong
     tracker and the user has no way to notice.

9. **Serial contention.** `ReceiverPairingClient` holds the port exclusively for a
   session. The calibration flow needs its own long-lived console session. Add one
   shared console client rather than a second ad-hoc port owner, and make pairing and
   calibration mutually exclusive.

---

## Task 1 — rotation in the SolarXR feed

- `src/main/services/solarxr.ts`: set `trackerMask.rotation = true`; decode
  `tracker.rotation()` into `rotation?: { x, y, z, w }` on `TrackerInfo`.
- **Feed rate.** `minimumTimeSinceLastMs` is 200 ms today — 5 Hz is unusable for a 3D
  preview and marginal for turn counting at 360 °/s. Rather than raising it app-wide
  (5× IPC traffic on every screen), add a `slimevr:set-feed-rate` endpoint and have the
  preview/calibration views request ~30 ms while mounted, restoring 200 ms on unmount.
- 4-file lockstep per `CLAUDE.md`: `shared/types.ts`, `main/ipc.ts`, the service,
  `preload/index.ts`.
- Extend `tests/solarxr.test.ts` with a rotation roundtrip.

## Task 2 — 3D tracker preview

- Port `IMUVisualizerWidget.tsx` from SlimeVR-Server's GUI (MIT — keep the notice) as
  `src/renderer/src/components/TrackerPreview.tsx`. Reuse its SlimeVR-quaternion →
  three.js axis mapping verbatim.
- Add `three` + `@types/three`.
- **Ship a primitive box + axis arrows first** so Task 3 is not blocked on a GLTF asset;
  swap in the VYRO model behind the same component API afterwards.
- Dispose the WebGL renderer and cancel the RAF loop on unmount — Electron leaks
  contexts across view switches otherwise.

## Task 3 — guided sensitivity calibration flow

**Config** (`src/shared/config.ts`, single source of truth): command template,
revolutions (default 10, max 100), the mirrored firmware constants (bias window 1000 ms, start
timeout 30 s, spin timeout 60 s, stop dwell 1 s, start 30 dps / stop 10 dps, min
fraction 0.85, scale clamp 0.9–1.1, off-axis warn 0.10 / reject 0.25), and the console
ack/error regexes.

**Pure logic** in `src/shared/sens-cal.ts` — no Electron, unit-tested in
`tests/sens-cal.test.ts`:
- yaw unwrap + turn accumulator from a quaternion stream,
- the phase state machine as a fold over `(elapsedMs, rotationSample, consoleLine)`,
- verification residual → deg/turn + pass/fail.

**Main service** `src/main/services/receiver-console.ts`: long-lived console client
(open, write arbitrary command, stream lines), returned by `registerIpc` for
`before-quit` teardown, mutually exclusive with the pairing client.

**UI** `src/renderer/src/flows/SensCalFlow.tsx` + a home action + `en.ts` keys first
(it is the schema), then `zh.ts`/`pt.ts`:
pick tracker → confirm identity (wiggle) → per axis Z (flat), X, Y (on edge) with
placement graphics → edge-alignment coaching → send → phase mirror + turn counter +
countdown against the 60 s budget → stop instruction → verification spin →
pass/fail with a named likely cause on failure → offer re-run.

---

## Suggested PR slicing

1. Rotation in the feed + feed-rate control + tests.
2. Preview widget (box model).
3. `shared/sens-cal.ts` math + config constants + tests (no UI).
4. `receiver-console` service + IPC.
5. The flow UI + i18n.

Then firmware/receiver Task F3, and replace the timeout inference with the real state.

## Open questions

- Does the quaternion feed actually stay live through a sens-cal run? (predicted yes — finding 5)
- Slot ↔ SlimeVR tracker mapping: is the address ever visible in the SolarXR name? (finding 8)
- Can the console CDC be held while SlimeVR Server holds the HID interface? (handoff says yes; unverified here)
