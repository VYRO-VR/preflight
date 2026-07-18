// Pure firmware up-to-date comparison, shared by main and renderer.
//
// Every VYRO firmware file embeds the short commit of the source it was built
// from (see @shared/firmware-naming), and devices report the commit they run:
// the receiver in its `info` banner (`Commit v1.2.0-4-gf750a5b`), trackers via
// the firmware string SlimeVR Server relays. "Up to date" therefore means "the
// device's commit is the latest release's commit" — no fragile build-date
// comparisons between devices.

import type { FirmwareMatch } from './types'

/**
 * Normalize a commit-ish token to a bare short hash: accepts a plain hash
 * ("f750a5b"), a git describe ("v1.2.0-4-gf750a5b"), or any string ending in
 * one. Returns undefined when no hash can be found.
 */
export function commitToken(text?: string): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  // git describe: take the trailing g<hash> part.
  const described = /-g([0-9a-f]{6,40})$/i.exec(trimmed)
  if (described) return described[1].toLowerCase()
  // A hash anywhere at the end of the string (e.g. "SmolSlime 2309f8b").
  const tail = /\b([0-9a-f]{6,40})$/i.exec(trimmed)
  if (tail && /[a-f]/i.test(tail[1])) return tail[1].toLowerCase()
  // The whole string is a hash (digits-only hashes pass here when exact).
  if (/^[0-9a-f]{6,40}$/i.test(trimmed)) return trimmed.toLowerCase()
  return undefined
}

/** Whether two commit hashes refer to the same commit (short vs long). */
export function commitsEqual(a: string, b: string): boolean {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x.startsWith(y) || y.startsWith(x)
}

/**
 * Compare an installed firmware's commit-ish string against the latest
 * release's commit. When either side is unreadable the result is 'unknown'
 * rather than a false alarm.
 */
export function matchToLatest(installed?: string, latestCommit?: string): FirmwareMatch {
  const current = commitToken(installed)
  const latest = latestCommit ? commitToken(latestCommit) ?? latestCommit.toLowerCase() : undefined
  if (!current || !latest) return { status: 'unknown', current, latest }
  return { status: commitsEqual(current, latest) ? 'match' : 'mismatch', current, latest }
}
