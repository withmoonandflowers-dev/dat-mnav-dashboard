import type { DataPoint } from '../types'

export default function DashboardCards({ data }: { data: DataPoint[] }) {
  const latest = data[data.length - 1]
  const prev = data[data.length - 2]
  if (!latest || !prev) return null

  const btcChange = ((latest.btc_price - prev.btc_price) / prev.btc_price) * 100
  const isPremium = latest.mnav >= 1

  const cards = [
    {
      label: 'Current mNAV',
      value: latest.mnav.toFixed(2) + 'x',
      sub: isPremium
        ? `+${latest.premium_pct.toFixed(1)}% Premium`
        : `${latest.premium_pct.toFixed(1)}% Discount`,
      color: isPremium ? 'text-green-400' : 'text-red-400',
      big: true,
    },
    {
      label: 'BTC Price',
      value: `$${latest.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: `${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
      color: btcChange >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'MSTR Market Cap',
      value: `$${(latest.mstr_market_cap / 1e9).toFixed(1)}B`,
      sub: `Stock: $${latest.mstr_close.toFixed(2)}`,
      color: 'text-orange-400',
    },
    {
      label: 'BTC Holdings',
      value: latest.btc_holdings.toLocaleString(),
      sub: `NAV: $${(latest.btc_nav / 1e9).toFixed(1)}B`,
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
        Data as of {latest.date} &middot; {data.length} data points
      </div>
    </div>
  )
}
