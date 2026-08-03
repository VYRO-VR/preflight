import { SUPPORTED_LOCALES, type Locale } from '../i18n'
import { useAppStore } from '../store/useAppStore'

/** Compact language dropdown shown in the app's top-right corner. */
export function LanguageSelector() {
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      <span aria-hidden>🌐</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Language"
        className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
