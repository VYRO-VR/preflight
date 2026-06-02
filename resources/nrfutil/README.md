# nrfutil (bundled firmware tool)

Hex / DFU receivers (e.g. HolyIOT) are flashed with Nordic's `nrfutil` — the
same engine nRF Connect Programmer uses. The binary is **not** committed to the
repo because it is large and platform-specific.

## How to provide it

Place the executable in this folder before packaging:

- Windows: `resources/nrfutil/nrfutil.exe`
- macOS / Linux: `resources/nrfutil/nrfutil`

Then install the `device` command it needs:

```
nrfutil install device
```

(The `nrfutil-device` plugin must sit alongside the binary as nrfutil expects.)

The app resolves the binary at runtime in this order:

1. `VYRO_NRFUTIL_PATH` environment variable (explicit override, handy in dev),
2. this bundled location (`<resources>/nrfutil/nrfutil[.exe]`),
3. `nrfutil` on the system `PATH`.

If none is found, the receiver update flow disables the hex/DFU path and tells
the user the tool isn't bundled — the UF2 path still works without nrfutil.

Download: https://www.nordicsemi.com/Products/Development-tools/nRF-Util
