import { useMemo } from 'react'
import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

export default function StatsTable({ data }: { data: DataPoint[] }) {
  const { locale } = useLocale()

  const stats = useMemo(() => {
    if (data.length === 0) return null

    const mnavs = data.map(d => d.mnav)
    const n = mnavs.length
    const mean = mnavs.reduce((a, b) => a + b, 0) / n
    const variance = mnavs.reduce((a, v) => a + (v - mean) ** 2, 0) / n
    const stddev = Math.sqrt(variance)

    let minIdx = 0, maxIdx = 0
    for (let i = 1; i < n; i++) {
      if (mnavs[i] < mnavs[minIdx]) minIdx = i
      if (mnavs[i] > mnavs[maxIdx]) maxIdx = i
    }

    const premiumDays = mnavs.filter(v => v > 1).length
    const discountDays = mnavs.filter(v => v < 1).length

    const r = pearson(data.map(d => d.btc_price), mnavs)

    return {
      mean,
      stddev,
      min: mnavs[minIdx],
      minDate: data[minIdx].date,
      max: mnavs[maxIdx],
      maxDate: data[maxIdx].date,
      premiumDays,
      premiumPct: (premiumDays / n) * 100,
      discountDays,
      discountPct: (discountDays / n) * 100,
      correlation: r,
      totalDays: n,
    }
  }, [data])

  if (!stats) return null

  const rows = [
    { label: t(locale, 'stats.mean'), value: stats.mean.toFixed(4) + 'x' },
    { label: t(locale, 'stats.stddev'), value: stats.stddev.toFixed(4) },
    { label: t(locale, 'stats.min'), value: `${stats.min.toFixed(4)}x (${stats.minDate})` },
    { label: t(locale, 'stats.max'), value: `${stats.max.toFixed(4)}x (${stats.maxDate})` },
    {
      label: t(locale, 'stats.premiumDays'),
      value: `${stats.premiumDays} / ${stats.totalDays} (${stats.premiumPct.toFixed(1)}%)`,
      color: 'text-green-400',
    },
    {
      label: t(locale, 'stats.discountDays'),
      value: `${stats.discountDays} / ${stats.totalDays} (${stats.discountPct.toFixed(1)}%)`,
      color: 'text-red-400',
    },
    { label: t(locale, 'stats.correlation'), value: stats.correlation.toFixed(4) },
  ]

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">{t(locale, 'stats.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {rows.map((row, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{row.label}</p>
            <p className={`text-sm font-semibold ${row.color || 'text-white'}`}>{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
