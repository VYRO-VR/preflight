# Yaw Drift Work: Handoff for Claude Code

## Background

Goal: increase time between yaw/full resets on VYRO IBIS trackers (LSM6DSV or ICM-45686 IMU, QMC6309 mag). Stack: tracker firmware `VYRO-VR/jitingcn-smol-slime-firmware`, receiver `VYRO-VR/SlimeVR-Tracker-nRF-Receiver`, GUI `VYRO-VR/preflight` (Electron + React + TS), plus upstream `SlimeVR/SlimeVR-Server`.

Yaw drift sources and what's already covered in the firmware:
- Gyro bias: handled. T-Cal on (`CONFIG_SENSOR_USE_TCAL=y`), boot calibration on (`CONFIG_SENSOR_USE_BOOT_CALIBRATION=y`), VQF rest + motion bias estimation on.
- Integration timing: handled. LSM6DSV driver reads `INTERNAL_FREQ_FINE` (`LSM6DSV.c:110`) and scales ODR. ICM variant uses external 32k clock.
- Gyro scale factor: NOT handled per unit. This is the biggest untapped lever. A 0.5% scale error = 1.8° yaw error per full body turn, accumulating with every turn. Firmware has `sens auto <x|y|z> [rev]` (`cal_sens.c`, `console.c:791`) but it is manual-only, default 2 revolutions (`CONFIG_SENSOR_SENS_REV=2`).

**Phase 1 (do first): guided gyro sensitivity calibration in Preflight.** Highest ROI, helps every tracker including mag-less ones.
**Phase 2: magnetometer interference hardening in firmware.**
**Phase 3 (later, optional): server-side cross-tracker mag corroboration.**

---

## Phase 1a: Preflight (repo: VYRO-VR/preflight)

### Task 1: Add rotation to the SolarXR data feed
- `src/main/services/solarxr.ts` line ~35: mask currently sets only `trackerMask.info` and `trackerMask.status`. Add `trackerMask.rotation = true`. Decode the quaternion from `DataFeedUpdate` and include it per tracker in the `slimevr:live-state` stream payload.
- Follow the repo's 4-file IPC lockstep (see CLAUDE.md): `shared/types.ts`, `main/ipc.ts`, service, `preload/index.ts`.

### Task 2: 3D tracker preview widget
- Port `gui/src/components/widgets/IMUVisualizerWidget.tsx` from SlimeVR-Server (MIT licensed, keep the license notice). It is plain three.js (no react-three-fiber): ~200px canvas, GLTF model, quaternion applied per frame, arrow helpers for accel/mag. Reuse its SlimeVR-quaternion-to-three.js axis mapping verbatim; that mapping is the error-prone part.
- Swap the GLTF for a VYRO tracker model. Add `three` to dependencies. Drive it from the rotation added in Task 1 via the Zustand store.

### Task 3: Guided sensitivity calibration flow
New flow (or extend `src/renderer/src/flows/CalibrateFlow.tsx`). Per axis (Z first, flat on desk; then X and Y stood on edge, with per-axis placement graphics):

1. User picks tracker from live feed; preview widget confirms identity (wiggle test).
2. Coach physical alignment: butt a flat edge of the tracker against the edge of a heavy object (book/box). This is the accuracy-critical instruction. Edge alignment gives ~±1° repeatability; over 10 turns that is a 0.03% error floor. Eyeballing gives ~±10° = 0.28% floor, same order as the error being removed.
3. Send the start command over the receiver serial console: `send <id> sens auto <axis> 10`. Use 10 revolutions, not the default 2. Check `SENS_CAL_MAX_REVOLUTIONS` for the ceiling. Command strings go in `shared/config.ts` (single source of truth). The receiver console CDC is a separate USB interface from the HID that SlimeVR Server holds, so both work simultaneously. Alternative channel if preferred: the receiver HID command protocol already has a sens-auto opcode (`rcv_cmd_remote_sens_auto_hid`, `rcv_cmd.c:481`).
4. Mirror the firmware phase machine on screen (phases from `cal_sens.c`): hold still (LED long pattern) → bias measurement → "spin now" (LED flashing) → recording (LED solid) → complete (oneshot pattern). Firmware self-rejects bad runs: not still, no spin detected, timeout, angle too small, invalid scale.
5. Live turn counter: unwrap accumulated yaw from the rotation feed, display "7.2 / 10 turns". It is measured by the uncalibrated gyro (up to ~1% off), fine as a progress dial.
6. Stop instruction: re-butt the edge against the object.
7. Verification spin (pure GUI math, required): user repeats the 10 turns; measure start-vs-end quaternion yaw residual; report remaining error in deg/turn; pass/fail threshold; offer re-run. This is also the success detector for v1 (see gap below).

### Known gap (v1 workaround)
`cal_sens.c` reports success/failure/computed scale only via `printk` to the tracker's OWN serial console. Nothing comes back over ESB. v1: infer via phase timeouts + the verification spin. v2: firmware Task F3 below fixes this properly.

---

## Phase 1b: Firmware (repo: VYRO-VR/jitingcn-smol-slime-firmware) + Receiver

### Task F3 (small): report sens-cal state/result over ESB
Extend the remote-confirm path (`esb_set_remote_confirm_cb` exists on the receiver) or add a byte to the status sub-packet (type 3) carrying calibration state + result (success/failure code, computed scale). Receiver forwards it; Preflight consumes it to replace timeout-based inference. ~dozen lines each side.

---

## Phase 2: Magnetometer hardening (firmware)

Context findings, verified in code:
- Mag on/off toggling (`sensor_set_mag_enabled`, `sensor.c` ~1650) suspends the sensor thread, calls `main_imu_restart()` → full `sensor_fusion->init(...)` (visible orientation glitch), and does a synchronous eager NVS flash write (`sys_write` → `nvs_write`). Never use it as a runtime control knob. If the sensor isn't initialized it reboots the tracker.
- Disturbance detection compares only field NORM and DIP against a reference (`vqf.c` params: `magNormTh=0.08`, `magDipTh=6.0`; EQF checks norm only). Blind spot: a distortion that rotates the horizontal field direction without changing norm/dip (chair legs, bed springs) passes undetected.
- New-field adoption vulnerability: `magNewTime=12.0f`, `magNewMinGyr=16.0f` (`vqf.c:179-183`). 12 cumulative seconds of >16°/s movement while near a consistent disturbed field makes the filter ADOPT the bad field as the new reference (`vqf.c:881-895` sets `magDistDetected=false`).
- Same pattern at the calibration layer: `online_mag.c` opens its sample gate after 5 s of sustained disturbance, and `ONLINE_VQF_DIST_MIN_DURATION_MS=3000` lets sustained disturbance trigger recalibration checks. `magneto_blend_BAinv` blends a DIVERGENT candidate at up to `ONLINE_BLEND_MAX_ALPHA=0.70` (more divergent = trusted more), and commits persist to flash. A long session near interference can permanently corrupt the stored hard/soft-iron calibration.
- Full Reset is server-side only (`TrackerResetsHandler.resetFull`), never touches firmware mag state, and calibrates against HMD yaw, not magnetic north.
- `mag_dist_detected` is already smuggled to the host by sign-flipping the temperature byte (`connection.c`, `connection_update_sensor_temp`).

### Task F1: `ESB_PONG_FLAG_MAG_HOLD` (new lightweight command)
New PONG flag (tracker + receiver side). When set, a firmware flag that:
- forces `magDistDetected = true` in `updateMag_internal` (mag correction k=0),
- skips the new-field acceptance branch (`vqf.c:889`),
- blocks `magneto_online_commit_BAinv` in `online_mag.c`.
NO fusion restart, NO NVS write, revertible with a matching UNHOLD flag. This is the safe runtime control that MAG_ON/MAG_OFF is not.

### Task F2: rest-gated heading disturbance check
In `updateMag_internal` (vqf.c; analogous in eqf.c): `state->lastMagDisAngle` (mag-implied heading disagreement) is already computed every sample. Add: while `state->restDetected` is true, if `lastMagDisAngle` moves more than a small threshold (~2°) from its value at rest entry, force `magDistDetected = true` regardless of norm/dip. Reset the reference on motion. Rationale: a stationary tracker's mag heading should not move; rest state and mag disturbance detection are currently computed independently and never cross-referenced. Limitation (accepted): only catches interference while at rest.

### Task F4 (optional, lower priority)
- Reset-anchored reference: on a (new) command from the host at Full Reset time, lock `magRefNorm/magRefDip` and suppress/lengthen new-field acceptance for a period, so the 12 s adoption window cannot silently overwrite a known-good baseline.
- Raw mag spike gate: reject a sample that jumps too far from the previous raw sample before it reaches the `magCurrentTau` low-pass.
- Mag temperature compensation: none exists (`mag_none_temp_read` is a stub); QMC6309 bias drifts with temperature.
- Fix the backwards blend logic risk: do not let high divergence increase blend alpha for a solo tracker; require corroboration or explicit user action before committing a strongly divergent calibration to flash.

---

## Phase 3 (later): server-side cross-tracker mag corroboration (SlimeVR-Server)

The data already flows: nRF trackers send packet type 4 (quat + CALIBRATED device-frame mag, Q10 gauss, every 100 ms) whenever mag is enabled; server parses it (`HIDCommon.kt:264`) into `Tracker._magVector`; `getMagVector()` rotates it into the reset-aligned reference frame. Currently only used for the GUI data feed. (Note: the ESP/UDP path has NO mag data; this is nRF/HID only.)

Design notes:
- Primary corroboration signal: norm and dip (yaw-invariant, immune to the circularity where a converged filter makes a disturbed field's heading look constant while the reported yaw is wrong). Secondary: yaw-vs-neighbors via Stay Aligned's existing structures (`TrackerSkeleton`, `YawErrors`).
- Snapshot per-tracker RELATIVE baselines at Full Reset (rooms have legitimately non-uniform fields; absolute agreement thresholds false-positive). Watch for changes in relative offsets.
- Bias toward rejection when ambiguous (2-tracker ambiguity, correlated interference like bed springs): the fallback is gyro + Stay Aligned, which is today's baseline. The failure to prevent is ACCEPTANCE of a bad field.
- Actuate via the new MAG_HOLD flag (Task F1) through the existing HID → receiver → PONG path, never via setMag.
- Stay Aligned already skips mag-enabled trackers entirely (`AdjustTrackerYaw.kt`: returns if `magStatus == ENABLED`); consider treating a held tracker as mag-disabled for Stay Aligned purposes.

## Non-goals / do not chase
- Receiver-side storage of raw mag history (RAM/flash prohibitive, unnecessary; corroboration needs only current per-tracker state).
- Radio/TDMA/packet loss as a drift source (fusion runs on the tracker; the receiver only forwards).
- ODR error compensation (already done via FREQ_FINE).
- Runtime mag enable/disable toggling as a correction mechanism.
