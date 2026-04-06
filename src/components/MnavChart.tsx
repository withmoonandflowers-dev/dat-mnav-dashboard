import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts'
import type { DataPoint } from '../types'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as DataPoint
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
  const mnavValues = data.map(d => d.mnav)
  const yMin = Math.floor(Math.min(...mnavValues) * 10) / 10 - 0.1
  const yMax = Math.ceil(Math.max(...mnavValues) * 10) / 10 + 0.1

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-lg font-semibold">mNAV Analysis</h2>
          <p className="text-sm text-gray-400">Multiple to Net Asset Value (Diluted Shares)</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Formula</p>
          <p className="text-xs text-gray-400 font-mono">Market Cap / (BTC Holdings x BTC Price)</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
          <ReferenceLine
            y={1}
            stroke="#f7931a"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{ value: '1.0x = Fair Value', position: 'insideTopRight', fill: '#f7931a', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="mnav"
            stroke="#ffaa33"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#ffaa33', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          <span>&gt;1.0x = Premium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <span>&lt;1.0x = Discount</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0 border-t-2 border-dashed border-orange-500" />
          <span>Fair Value Line</span>
        </div>
      </div>
    </div>
  )
}
