import { useEffect, useState } from 'react'
import type { MnavData } from './types'
import DashboardCards from './components/DashboardCards'
import MnavChart from './components/MnavChart'
import BtcChart from './components/BtcChart'
import AiSummary from './components/AiSummary'
import LiveRefresh from './components/LiveRefresh'

export default function App() {
  const [mnavData, setMnavData] = useState<MnavData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/mnav_timeseries.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => { setMnavData(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading mNAV data...</p>
        </div>
      </div>
    )
  }

  if (error || !mnavData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-xl mb-2">Failed to load data</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  const { data, metadata } = mnavData

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-black text-sm">D</div>
            <div>
              <h1 className="text-lg font-bold">DAT.co mNAV Dashboard</h1>
              <p className="text-xs text-gray-500">Digital Asset Treasury Analytics</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Strategy (MSTR)</p>
            <p className="text-xs text-gray-400">{metadata.total_data_points} data points</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <LiveRefresh latestStatic={data[data.length - 1]} onLiveUpdate={() => {}} />
        <DashboardCards data={data} />
        <MnavChart data={data} />
        <BtcChart data={data} />
        <AiSummary />

        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Methodology</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
            <div>
              <h3 className="text-white font-medium mb-2">What is mNAV?</h3>
              <p className="mb-2">
                mNAV (Market Multiple of Net Asset Value) measures how much the market
                values a company relative to its Bitcoin holdings. An mNAV of 1.5x means
                investors pay $1.50 for every $1.00 of Bitcoin the company holds.
              </p>
              <p>
                <span className="text-green-400">mNAV &gt; 1.0</span> indicates a premium.{' '}
                <span className="text-red-400">mNAV &lt; 1.0</span> indicates a discount.
              </p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Data Sources</h3>
              <ul className="space-y-1">
                <li><span className="text-orange-400">BTC Price:</span> {metadata.data_sources.btc_price}</li>
                <li><span className="text-orange-400">MSTR Stock:</span> {metadata.data_sources.mstr_stock}</li>
                <li><span className="text-orange-400">BTC Holdings:</span> {metadata.data_sources.btc_holdings}</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                Shares uses Effective Diluted Shares. Cross-validated against StrategyTracker.com.
              </p>
              <h3 className="text-white font-medium mt-4 mb-2">Data Update Architecture</h3>
              <ul className="space-y-1 text-xs">
                <li><span className="text-green-400">Layer 1:</span> GitHub Actions runs daily at 14:00 TST — auto-fetches, computes, and re-deploys</li>
                <li><span className="text-green-400">Layer 2:</span> "Refresh Live" button — real-time BTC price from CoinGecko API (client-side)</li>
                <li><span className="text-green-400">Layer 3:</span> Static JSON fallback — always available even if APIs are down</li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 text-xs text-gray-600 border-t border-[#1a1a1a]">
          <p>DAT.co mNAV Dashboard &middot; Built for educational purposes &middot; Data: {new Date(metadata.generated_at).toLocaleDateString()}</p>
          <p className="mt-1">Not financial advice.</p>
        </footer>
      </div>
    </main>
  )
}
