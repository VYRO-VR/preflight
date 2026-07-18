import { useEffect, useMemo, useState } from 'react'
import type { FirmwareAsset, FirmwareKind } from '@shared/types'
import {
  candidatesFor,
  firmwareBoards,
  guessBoardKey,
  resolveFirmware
} from '@shared/firmware-naming'
import { useAppStore } from '../store/useAppStore'

interface Props {
  assets: FirmwareAsset[]
  kind: FirmwareKind
  /** Free-form text (e.g. the receiver's reported board) used to suggest a board. */
  detectFrom?: string
  /** Fires whenever the resolved firmware file changes. */
  onChange: (asset: FirmwareAsset | undefined) => void
}

const selectClass =
  'rounded border border-surface-border bg-surface px-2 py-1 text-sm text-slate-200'

/**
 * Board dropdown that resolves to exactly one firmware file. Every VYRO build
 * ships one file per board — all options are baked in — so there is nothing
 * else to choose.
 */
export function FirmwarePicker({ assets, kind, detectFrom, onChange }: Props) {
  const t = useAppStore((s) => s.t)
  const [boardKey, setBoardKey] = useState<string | null>(null)

  const boards = useMemo(() => firmwareBoards(assets, kind), [assets, kind])
  const suggestedKey = useMemo(() => guessBoardKey(detectFrom, boards), [detectFrom, boards])

  // Initialise (or repair) the selection once boards are available.
  useEffect(() => {
    if (boards.length === 0) {
      setBoardKey(null)
      return
    }
    setBoardKey((prev) => {
      if (prev && boards.some((b) => b.key === prev)) return prev
      return suggestedKey ?? boards[0].key
    })
  }, [boards, suggestedKey])

  const resolved = useMemo(
    () => (boardKey ? resolveFirmware(candidatesFor(assets, kind, boardKey)) : undefined),
    [assets, kind, boardKey]
  )

  useEffect(() => {
    onChange(resolved)
    // onChange identity is owned by the parent; track the resolved file only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.name])

  if (boards.length === 0) return null

  const boardLabel = kind === 'receiver' ? t('fw.pick.board.receiver') : t('fw.pick.board')

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-200">{boardLabel}</span>
        <select
          className={selectClass}
          value={boardKey ?? ''}
          onChange={(e) => setBoardKey(e.target.value)}
        >
          {boards.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        {suggestedKey && boardKey === suggestedKey && (
          <span className="text-xs text-brand-300">
            {t('fw.pick.detected', {
              board: boards.find((b) => b.key === suggestedKey)?.label ?? ''
            })}
          </span>
        )}
      </label>

      {/* Resolved file readout */}
      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
        <div className="text-xs uppercase text-slate-500">{t('fw.pick.file')}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-slate-100">
          {resolved ? resolved.name : t('fw.pick.none')}
        </div>
      </div>
    </div>
  )
}
