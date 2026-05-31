import { en } from './en'
import { pt } from './pt'

export type TranslationKey = keyof typeof en
export type Locale = 'en' | 'pt'

const dictionaries: Record<Locale, Record<string, string>> = { en, pt }

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' }
]

/**
 * Tiny dependency-free translator. Falls back to English, then to the key
 * itself, and supports `{name}`-style interpolation.
 */
export function createTranslator(locale: Locale) {
  const dict = dictionaries[locale] ?? en
  return (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str = dict[key] ?? en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return str
  }
}
