import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
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

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    den += (x[i] - mx) * (x[i] - mx)
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  return { slope, intercept }
}

interface ScatterPoint {
  btc_price: number
  mnav: number
  date: string
  colorIdx: number
}

function CorrTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as ScatterPoint
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-sm shadow-xl">
      <p className="text-orange-400 font-semibold">{d.date}</p>
      <p className="text-gray-300">BTC: ${d.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      <p className="text-gray-300">mNAV: {d.mnav.toFixed(4)}x</p>
    </div>
  )
}

export default function CorrelationChart({ data }: { data: DataPoint[] }) {
  const { locale } = useLocale()

  const { scatterData, r, rSquared, regLine } = useMemo(() => {
    const xs = data.map(d => d.btc_price)
    const ys = data.map(d => d.mnav)
    const r = pearson(xs, ys)
    const rSquared = r * r
    const { slope, intercept } = linearRegression(xs, ys)

    const scatterData: ScatterPoint[] = data.map((d, i) => ({
      btc_price: d.btc_price,
      mnav: d.mnav,
      date: d.date,
      colorIdx: i,
    }))

    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const regLine = [
      { btc_price: xMin, mnav: slope * xMin + intercept },
      { btc_price: xMax, mnav: slope * xMax + intercept },
    ]

    return { scatterData, r, rSquared, regLine }
  }, [data])

  // Color function: lighter for early, brighter orange for recent
  const getColor = (idx: number) => {
    const ratio = data.length > 1 ? idx / (data.length - 1) : 1
    const r = Math.round(100 + 155 * ratio)
    const g = Math.round(80 + 90 * ratio)
    const b = Math.round(20 + 6 * (1 - ratio))
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t(locale, 'chart.corr.title')}</h2>
          <p className="text-sm text-gray-400">{t(locale, 'chart.corr.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">{t(locale, 'chart.corr.pearson')}</p>
          <p className="text-2xl font-bold text-orange-400">{r.toFixed(4)}</p>
          <p className="text-xs text-gray-500">R² = {rSquared.toFixed(4)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="btc_price"
            type="number"
            name="BTC Price"
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
            label={{ value: 'BTC Price', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 11 }}
          />
          <YAxis
            dataKey="mnav"
            type="number"
            name="mNAV"
            tick={{ fill: '#666', fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
            label={{ value: 'mNAV', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11 }}
          />
          <Tooltip content={<CorrTooltip />} />
          {/* Regression line */}
          <Scatter
            data={regLine}
            line={{ stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '6 3' }}
            shape={() => <></>}
            legendType="none"
            isAnimationActive={false}
          />
          {/* Data scatter with colored dots */}
          <Scatter
            data={scatterData}
            shape={(props: any) => {
              const { cx, cy, payload } = props
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={getColor(payload.colorIdx)}
                  fillOpacity={0.8}
                  stroke="none"
                />
              )
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 rounded" style={{ background: 'linear-gradient(to right, rgb(100,80,20), rgb(255,170,26))' }} />
          <span>Time (early → recent)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t-2 border-dashed border-red-500" />
          <span>Regression Line</span>
        </div>
      </div>
    </div>
  )
}
