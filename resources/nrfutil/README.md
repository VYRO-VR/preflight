# nrfutil (bundled firmware tool)

Hex / DFU receivers (e.g. HolyIOT) are flashed with Nordic's `nrfutil` — the
same engine nRF Connect Programmer uses. The binary is **not** committed to the
repo because it is large and platform-specific.

## How it is provided

The installer/release CI workflows download the binary automatically (see the
"Fetch nrfutil" step in `.github/workflows/installer.yml`, `release.yml`, and
`release-on-merge.yml`) from Nordic's official distribution:

- Windows: `https://developer.nordicsemi.com/.pc-tools/nrfutil/x64-windows/nrfutil.exe`
- macOS: `https://developer.nordicsemi.com/.pc-tools/nrfutil/universal-osx/nrfutil`
- Linux: `https://developer.nordicsemi.com/.pc-tools/nrfutil/x64-linux/nrfutil`

For a local packaging run, download the matching binary yourself into this
folder first:

- Windows: `resources/nrfutil/nrfutil.exe`
- macOS / Linux: `resources/nrfutil/nrfutil`

Only the launcher binary is needed. nrfutil's `device` command is a plugin,
and the app installs it on demand (`nrfutil install device`) the first time it
flashes — which requires network access, but so does downloading the firmware,
so this adds no new requirement.

The app resolves the binary at runtime in this order:

1. `VYRO_NRFUTIL_PATH` environment variable (explicit override, handy in dev),
2. this bundled location (`<resources>/nrfutil/nrfutil[.exe]`),
3. `nrfutil` on the system `PATH`.

If none is found, the receiver update flow disables the hex/DFU path and tells
the user the tool isn't bundled — the UF2 path still works without nrfutil.

Download: https://www.nordicsemi.com/Products/Development-tools/nRF-Util
