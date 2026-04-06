import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot, Legend
} from 'recharts'
import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

const MAJOR_PURCHASES = [
  { date: '2025-04-28', btc: 15355, label: '+15.4K' },
  { date: '2025-05-05', btc: 13390, label: '+13.4K' },
  { date: '2025-06-16', btc: 11931, label: '+11.9K' },
  { date: '2025-03-17', btc: 130, label: '+130' },
  { date: '2025-07-21', btc: 11897, label: '+11.9K' },
  { date: '2025-10-27', btc: 10107, label: '+10.1K' },
]

interface EnrichedDataPoint extends DataPoint {
  mnav_sma30: number | null
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as EnrichedDataPoint
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-orange-400 font-semibold mb-2">{d.date}</p>
      <div className="space-y-1">
        <p>
          <span className="text-gray-400">mNAV: </span>
          <span className={d.mnav >= 1 ? 'text-green-400' : 'text-red-400'}>
            {d.mnav.toFixed(4)}x
          </span>
        </p>
        {d.mnav_sma30 != null && (
          <p>
            <span className="text-gray-400">SMA30: </span>
            <span className="text-blue-400">{d.mnav_sma30.toFixed(4)}x</span>
          </p>
        )}
        <p>
          <span className="text-gray-400">Premium: </span>
          <span className={d.premium_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
            {d.premium_pct >= 0 ? '+' : ''}{d.premium_pct.toFixed(2)}%
          </span>
        </p>
        <hr className="border-gray-700 my-1" />
        <p className="text-gray-400">BTC: ${d.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        <p className="text-gray-400">MSTR: ${d.mstr_close.toFixed(2)}</p>
        <p className="text-gray-400">Holdings: {d.btc_holdings.toLocaleString()} BTC</p>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
        MCap: ${(d.mstr_market_cap / 1e9).toFixed(1)}B / NAV: ${(d.btc_nav / 1e9).toFixed(1)}B
      </div>
    </div>
  )
}

export default function MnavChart({ data }: { data: DataPoint[] }) {
  const { locale } = useLocale()

  // Feature 3: Compute 30-day SMA
  const enrichedData: EnrichedDataPoint[] = data.map((d, i) => {
    const window = data.slice(Math.max(0, i - 29), i + 1)
    const sma = window.reduce((s, w) => s + w.mnav, 0) / window.length
    return { ...d, mnav_sma30: i >= 29 ? +sma.toFixed(4) : null }
  })

  const mnavValues = data.map(d => d.mnav)
  const yMin = Math.floor(Math.min(...mnavValues) * 10) / 10 - 0.1
  const yMax = Math.ceil(Math.max(...mnavValues) * 10) / 10 + 0.1

  // Feature 1: Build date->index lookup for purchase annotations
  const dateSet = new Set(data.map(d => d.date))
  const purchaseDots = MAJOR_PURCHASES
    .filter(p => p.btc > 1000) // skip small ones
    .filter(p => dateSet.has(p.date))
    .map(p => {
      const point = data.find(d => d.date === p.date)!
      return { ...p, mnav: point.mnav }
    })

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t(locale, 'chart.mnav.title')}</h2>
          <p className="text-sm text-gray-400">{t(locale, 'chart.mnav.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{t(locale, 'chart.mnav.formula')}</p>
          <p className="text-xs text-gray-400 font-mono">{t(locale, 'chart.mnav.formulaText')}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={enrichedData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          {yMax > 1 && <ReferenceArea y1={1} y2={yMax} fill="#22c55e" fillOpacity={0.03} />}
          {yMin < 1 && <ReferenceArea y1={yMin} y2={1} fill="#ef4444" fillOpacity={0.03} />}
          <XAxis
            dataKey="date"
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(0, 7)}
            interval={Math.floor(data.length / 8)}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, color: '#999' }}
          />
          <ReferenceLine
            y={1}
            stroke="#f7931a"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{ value: t(locale, 'chart.mnav.fairValue'), position: 'insideTopRight', fill: '#f7931a', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="mnav"
            name="mNAV"
            stroke="#ffaa33"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#ffaa33', stroke: '#fff', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="mnav_sma30"
            name={t(locale, 'chart.sma')}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls={false}
          />
          {/* Feature 1: Purchase annotation dots */}
          {purchaseDots.map((p) => (
            <ReferenceDot
              key={p.date}
              x={p.date}
              y={p.mnav}
              r={5}
              fill="#f97316"
              stroke="#fff"
              strokeWidth={1}
              label={{
                value: p.label,
                position: 'top',
                fill: '#f97316',
                fontSize: 10,
                fontWeight: 600,
                offset: 8,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          <span>{t(locale, 'chart.mnav.premium')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <span>{t(locale, 'chart.mnav.discount')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0 border-t-2 border-dashed border-orange-500" />
          <span>{t(locale, 'chart.mnav.fairLine')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>BTC Purchase</span>
        </div>
      </div>
    </div>
  )
}
