import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

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
      <div className="col-span-2 lg:col-span-4 text-right text-xs text-gray-500">
        {t(locale, 'cards.dataAsOf')} {latest.date} &middot; {data.length} {t(locale, 'header.dataPoints')}
      </div>
    </div>
  )
}
