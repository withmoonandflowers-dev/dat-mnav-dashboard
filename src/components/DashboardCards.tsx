import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

function exportCsv(data: DataPoint[]) {
  const headers = ['date', 'mnav', 'premium_pct', 'btc_price', 'mstr_close', 'mstr_market_cap', 'btc_holdings', 'btc_nav']
  const rows = data.map(d => headers.map(h => (d as any)[h]))
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `mnav_data_${today}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DashboardCards({ data }: { data: DataPoint[] }) {
  const { locale } = useLocale()
  const latest = data[data.length - 1]
  const prev = data[data.length - 2]
  if (!latest || !prev) return null

  const btcChange = ((latest.btc_price - prev.btc_price) / prev.btc_price) * 100
  const isPremium = latest.mnav >= 1

  const cards = [
    {
      label: t(locale, 'cards.currentMnav'),
      value: latest.mnav.toFixed(2) + 'x',
      sub: isPremium
        ? `+${latest.premium_pct.toFixed(1)}% ${t(locale, 'cards.premium')}`
        : `${latest.premium_pct.toFixed(1)}% ${t(locale, 'cards.discount')}`,
      color: isPremium ? 'text-green-400' : 'text-red-400',
      big: true,
    },
    {
      label: t(locale, 'cards.btcPrice'),
      value: `$${latest.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: `${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
      color: btcChange >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: t(locale, 'cards.marketCap'),
      value: `$${(latest.mstr_market_cap / 1e9).toFixed(1)}B`,
      sub: `${t(locale, 'cards.stock')}: $${latest.mstr_close.toFixed(2)}`,
      color: 'text-orange-400',
    },
    {
      label: t(locale, 'cards.holdings'),
      value: latest.btc_holdings.toLocaleString(),
      sub: `${t(locale, 'cards.nav')}: $${(latest.btc_nav / 1e9).toFixed(1)}B`,
      color: 'text-orange-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 hover:border-orange-500/30 transition-colors"
        >
          <p className="text-sm text-gray-400 mb-1">{card.label}</p>
          <p className={`text-2xl font-bold ${card.big ? card.color : 'text-white'}`}>
            {card.value}
          </p>
          <p className={`text-xs mt-1 ${card.color}`}>{card.sub}</p>
        </div>
      ))}
      <div className="col-span-2 lg:col-span-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          {t(locale, 'cards.dataAsOf')} {latest.date} &middot; {data.length} {t(locale, 'header.dataPoints')}
        </span>
        <button
          onClick={() => exportCsv(data)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white hover:border-orange-500/50 transition-colors text-xs"
        >
          <span>📥</span>
          <span>{t(locale, 'export.csv')}</span>
        </button>
      </div>
    </div>
  )
}
