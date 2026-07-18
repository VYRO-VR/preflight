import { useEffect, useMemo, useState } from 'react'
import type { FirmwareAsset, FirmwareKind, FirmwareSelection } from '@shared/types'
import {
  candidatesFor,
  defaultSelection,
  dimensionValues,
  firmwareBoards,
  guessBoardKey,
  resolveFirmware
} from '@shared/firmware-naming'
import { useAppStore } from '../store/useAppStore'

interface Props {
  assets: FirmwareAsset[]
  kind: FirmwareKind
  /** Free-form text (e.g. reported firmware) used to suggest a board. */
  detectFrom?: string
  /** Fires whenever the resolved firmware file changes. */
  onChange: (asset: FirmwareAsset | undefined, exact: boolean) => void
}

const selectClass =
  'rounded border border-surface-border bg-surface px-2 py-1 text-sm text-slate-200'

/**
 * Board dropdown + the build options, derived entirely from the available
 * assets, that narrow down to exactly one firmware file. Magnetometer and deep
 * sleep are surfaced up front; everything else lives under "Advanced options".
 * Only dimensions that actually vary for the chosen board are shown.
 */
export function FirmwarePicker({ assets, kind, detectFrom, onChange }: Props) {
  const t = useAppStore((s) => s.t)
  const [selection, setSelection] = useState<FirmwareSelection | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const boards = useMemo(() => firmwareBoards(assets, kind), [assets, kind])
  const suggestedKey = useMemo(() => guessBoardKey(detectFrom, boards), [detectFrom, boards])

  // Initialise (or repair) the selection once boards are available.
  useEffect(() => {
    if (boards.length === 0) {
      setSelection(null)
      return
    }
    setSelection((prev) => {
      if (prev && boards.some((b) => b.key === prev.boardKey)) return prev
      const key = suggestedKey ?? boards[0].key
      return defaultSelection(candidatesFor(assets, kind, key), key)
    })
  }, [boards, suggestedKey, assets, kind])

  const candidates = useMemo(
    () => (selection ? candidatesFor(assets, kind, selection.boardKey) : []),
    [assets, kind, selection]
  )
  const dims = useMemo(() => dimensionValues(candidates), [candidates])
  const resolved = useMemo(
    () => (selection ? resolveFirmware(candidates, selection) : { asset: undefined, exact: false }),
    [candidates, selection]
  )

  useEffect(() => {
    onChange(resolved.asset, resolved.exact)
    // onChange identity is owned by the parent; track the resolved file only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.asset?.name, resolved.exact])

  if (boards.length === 0) return null

  const set = <K extends keyof FirmwareSelection>(key: K, value: FirmwareSelection[K]): void =>
    setSelection((prev) => (prev ? { ...prev, [key]: value } : prev))

  const changeBoard = (key: string): void =>
    setSelection(defaultSelection(candidatesFor(assets, kind, key), key))

  const optLabel = (dim: string, value: string | boolean): string => {
    if (typeof value === 'boolean') return value ? t('fw.pick.on') : t('fw.pick.off')
    return t(`fw.opt.${dim}.${value}` as Parameters<typeof t>[0])
  }

  // A labeled <select> for an enum dimension; rendered only when it varies.
  const enumRow = (
    dim: 'protocol' | 'bus' | 'clock' | 'fork',
    label: string,
    hint?: string
  ): JSX.Element | null => {
    const values = dims[dim]
    if (!selection || values.length <= 1) return null
    return (
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="flex items-center gap-2">
          {label}
          {hint && <span className="text-xs text-slate-500">{hint}</span>}
        </span>
        <select
          className={selectClass}
          value={String(selection[dim])}
          onChange={(e) => set(dim, e.target.value as never)}
        >
          {values.map((v) => (
            <option key={String(v)} value={String(v)}>
              {optLabel(dim, v)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  // A toggle for a boolean dimension; rendered only when both values exist.
  const boolRow = (
    dim: 'sleep' | 'mag' | 'sw0',
    label: string,
    explain?: string
  ): JSX.Element | null => {
    if (!selection || dims[dim].length <= 1) return null
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-200">{label}</div>
          {explain && <p className="mt-0.5 text-xs text-slate-500">{explain}</p>}
        </div>
        <select
          className={selectClass}
          value={selection[dim] ? 'on' : 'off'}
          onChange={(e) => set(dim, e.target.value === 'on')}
        >
          <option value="on">{t('fw.pick.on')}</option>
          <option value="off">{t('fw.pick.off')}</option>
        </select>
      </div>
    )
  }

  const boardLabel = kind === 'receiver' ? t('fw.pick.board.receiver') : t('fw.pick.board')
  const hasAdvanced =
    dims.protocol.length > 1 ||
    dims.bus.length > 1 ||
    dims.clock.length > 1 ||
    dims.fork.length > 1 ||
    dims.sw0.length > 1

  return (
    <div className="space-y-4">
      {/* Primary: board picker */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-200">{boardLabel}</span>
        <select
          className={selectClass}
          value={selection?.boardKey ?? ''}
          onChange={(e) => changeBoard(e.target.value)}
        >
          {boards.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        {suggestedKey && selection?.boardKey === suggestedKey && (
          <span className="text-xs text-brand-300">
            {t('fw.pick.detected', {
              board: boards.find((b) => b.key === suggestedKey)?.label ?? ''
            })}
          </span>
        )}
      </label>

      {/* Front-and-centre options */}
      {(dims.mag.length > 1 || dims.sleep.length > 1) && (
        <div className="space-y-3 rounded-lg border border-surface-border bg-surface px-4 py-3">
          {boolRow('mag', t('fw.pick.mag'), t('fw.pick.mag.explain'))}
          {boolRow('sleep', t('fw.pick.sleep'), t('fw.pick.sleep.explain'))}
        </div>
      )}

      {/* Everything else */}
      {hasAdvanced && (
        <div className="rounded-lg border border-surface-border bg-surface px-4 py-3">
          <button
            type="button"
            className="text-sm font-semibold text-brand-300 hover:text-brand-200"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? '▾ ' : '▸ '}
            {t('fw.pick.advanced')}
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              {enumRow('protocol', t('fw.pick.protocol'), t('fw.pick.protocol.hint'))}
              {enumRow('bus', t('fw.pick.bus'))}
              {enumRow('clock', t('fw.pick.clock'))}
              {enumRow('fork', t('fw.pick.fork'))}
              {boolRow('sw0', t('fw.pick.sw0'))}
            </div>
          )}
        </div>
      )}

      {/* Resolved file readout */}
      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
        <div className="text-xs uppercase text-slate-500">{t('fw.pick.file')}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-slate-100">
          {resolved.asset ? resolved.asset.name : t('fw.pick.none')}
        </div>
        {resolved.asset && !resolved.exact && (
          <p className="mt-1 text-xs text-amber-300">{t('fw.pick.closest')}</p>
        )}
      </div>
    </div>
  )
}
