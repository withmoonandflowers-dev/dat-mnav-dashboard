import { t } from '../i18n'
import { useLocale } from './LocaleContext'

export type DateRange = '1m' | '3m' | '6m' | '1y' | 'all'

const RANGES: DateRange[] = ['1m', '3m', '6m', '1y', 'all']

const I18N_KEYS: Record<DateRange, string> = {
  '1m': 'range.1m',
  '3m': 'range.3m',
  '6m': 'range.6m',
  '1y': 'range.1y',
  'all': 'range.all',
}

export function getCutoffDate(range: DateRange, latestDate: string): string | null {
  if (range === 'all') return null
  const d = new Date(latestDate)
  switch (range) {
    case '1m': d.setMonth(d.getMonth() - 1); break
    case '3m': d.setMonth(d.getMonth() - 3); break
    case '6m': d.setMonth(d.getMonth() - 6); break
    case '1y': d.setFullYear(d.getFullYear() - 1); break
  }
  return d.toISOString().slice(0, 10)
}

interface Props {
  selected: DateRange
  onSelect: (range: DateRange) => void
}

export default function DateRangeSelector({ selected, onSelect }: Props) {
  const { locale } = useLocale()

  return (
    <div className="flex items-center gap-1">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onSelect(r)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected === r
              ? 'bg-orange-500 text-black'
              : 'bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222] border border-[#2a2a2a]'
          }`}
        >
          {t(locale, I18N_KEYS[r])}
        </button>
      ))}
    </div>
  )
}
