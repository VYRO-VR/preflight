// electron-builder afterPack hook (see electron-builder.yml).
//
// Chromium's sandbox on Linux needs either a setuid-root chrome-sandbox
// helper or permission to create unprivileged user namespaces. An AppImage
// can provide neither on Ubuntu 23.10+/24.04+: its FUSE mount strips the
// setuid bit, and AppArmor blocks unprivileged user namespaces by default —
// so the app dies at startup with SIGTRAP unless launched with --no-sandbox.
//
// This hook renames the real Linux executable to <name>.bin and installs a
// tiny launcher in its place that detects that situation at runtime and
// relaunches with --no-sandbox only when the sandbox genuinely cannot work.
// The same app directory is used for the .deb, where the launcher is a
// no-op: the deb's postinst makes chrome-sandbox setuid, so the setuid
// check passes and the app runs fully sandboxed.
const { existsSync } = require('fs')
const { rename, writeFile } = require('fs/promises')
const path = require('path')

const wrapper = (bin) => `#!/bin/sh
# Launcher installed by build/linux-sandbox-fallback.cjs — see that file for
# why. Relaunches with --no-sandbox only when Chromium's sandbox cannot work
# (no setuid chrome-sandbox helper and unprivileged user namespaces blocked,
# e.g. any AppImage on Ubuntu 23.10+), or when running as root, which
# Chromium refuses with the sandbox enabled.
set -u
DIR="$(dirname "$(readlink -f "$0")")"
BIN="$DIR/${bin}"

# Respect an explicit user choice either way.
for arg in "$@"; do
  case "$arg" in
    --no-sandbox|--sandbox) exec "$BIN" "$@" ;;
  esac
done
[ -n "\${ELECTRON_DISABLE_SANDBOX:-}" ] && exec "$BIN" "$@"

need_fallback=0
if [ "$(id -u)" -eq 0 ]; then
  need_fallback=1
elif [ ! -u "$DIR/chrome-sandbox" ]; then
  userns_clone=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)
  userns_restrict=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)
  if [ "$userns_clone" != "1" ] || [ "$userns_restrict" != "0" ]; then
    need_fallback=1
  fi
fi

[ "$need_fallback" -eq 0 ] && exec "$BIN" "$@"
echo "preflight: Chromium sandbox unavailable on this system; relaunching with --no-sandbox." >&2
exec "$BIN" --no-sandbox "$@"
`

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return

  const exeName = context.packager.executableName || 'preflight'
  const exePath = path.join(context.appOutDir, exeName)
  if (!existsSync(exePath)) {
    throw new Error(`linux-sandbox-fallback: executable not found at ${exePath}`)
  }

  const binName = `${exeName}.bin`
  await rename(exePath, path.join(context.appOutDir, binName))
  await writeFile(exePath, wrapper(binName), { mode: 0o755 })
  console.log(`  • installed Linux sandbox-fallback launcher (${exeName} → ${binName})`)
}
