import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import type { DataPoint } from '../types'

function BtcTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as DataPoint
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-orange-400 font-semibold">{d.date}</p>
      <p className="text-white">BTC: ${d.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
    </div>
  )
}

export default function BtcChart({ data }: { data: DataPoint[] }) {
  const prices = data.map(d => d.btc_price)
  const yMin = Math.floor(Math.min(...prices) / 10000) * 10000 - 5000
  const yMax = Math.ceil(Math.max(...prices) / 10000) * 10000 + 5000

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Bitcoin Price (Correlation View)</h2>
        <p className="text-sm text-gray-400">Compare with mNAV chart above to observe pro-cyclical behavior</p>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f7931a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f7931a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(0, 7)}
            interval={Math.floor(data.length / 8)}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<BtcTooltip />} />
          <Area type="monotone" dataKey="btc_price" stroke="#ffaa33" strokeWidth={3} fill="url(#btcGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
