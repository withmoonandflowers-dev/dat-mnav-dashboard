import { useState } from 'react'
import type { DataPoint } from '../types'

interface LiveData {
  btc_price: number
  mstr_price: number | null
  timestamp: string
  source: string
}

interface Props {
  latestStatic: DataPoint
  onLiveUpdate: (liveData: LiveData) => void
}

export default function LiveRefresh({ latestStatic, onLiveUpdate }: Props) {
  const [loading, setLoading] = useState(false)
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLive = async () => {
    setLoading(true)
    setError(null)

    try {
      // CoinGecko simple/price — free, no auth, CORS allowed
      const btcResp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      )

      if (!btcResp.ok) throw new Error(`CoinGecko: HTTP ${btcResp.status}`)
      const btcJson = await btcResp.json()
      const btcPrice = btcJson.bitcoin?.usd
      if (!btcPrice) throw new Error('Invalid BTC price response')

      // Try to get MSTR price via a free proxy (may fail due to CORS)
      let mstrPrice: number | null = null
      try {
        // Yahoo Finance v8 doesn't support CORS, so we use a fallback
        const mstrResp = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=1d',
          { mode: 'cors' }
        )
        if (mstrResp.ok) {
          const mstrJson = await mstrResp.json()
          mstrPrice = mstrJson.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
        }
      } catch {
        // Expected: Yahoo Finance blocks CORS from browsers
        mstrPrice = null
      }

      const live: LiveData = {
        btc_price: btcPrice,
        mstr_price: mstrPrice,
        timestamp: new Date().toISOString(),
        source: mstrPrice ? 'CoinGecko + Yahoo Finance' : 'CoinGecko (BTC only)',
      }

      setLiveData(live)
      onLiveUpdate(live)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch live data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate live mNAV estimate if we have live BTC price
  const liveMnav = liveData
    ? latestStatic.mstr_market_cap / (latestStatic.btc_holdings * liveData.btc_price)
    : null

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${liveData ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <div>
            <p className="text-sm font-medium">
              {liveData ? 'Live Data Active' : 'Static Data Mode'}
            </p>
            <p className="text-xs text-gray-500">
              {liveData
                ? `Updated ${new Date(liveData.timestamp).toLocaleTimeString()} · ${liveData.source}`
                : `Showing data as of ${latestStatic.date} · Click Refresh for real-time`
              }
            </p>
          </div>
        </div>

        <button
          onClick={fetchLive}
          disabled={loading}
          className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Live
            </>
          )}
        </button>
      </div>

      {/* Live data comparison */}
      {liveData && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a] grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Live BTC</p>
            <p className="text-green-400 font-semibold">
              ${liveData.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600">
              was ${latestStatic.btc_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">BTC Change</p>
            <p className={`font-semibold ${liveData.btc_price >= latestStatic.btc_price ? 'text-green-400' : 'text-red-400'}`}>
              {((liveData.btc_price - latestStatic.btc_price) / latestStatic.btc_price * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Est. mNAV (live BTC)</p>
            <p className={`font-semibold ${(liveMnav ?? 0) >= 1 ? 'text-green-400' : 'text-red-400'}`}>
              {liveMnav?.toFixed(4)}x
            </p>
            <p className="text-xs text-gray-600">
              was {latestStatic.mnav.toFixed(4)}x
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">MSTR Price</p>
            <p className="text-gray-400 font-semibold">
              {liveData.mstr_price
                ? `$${liveData.mstr_price.toFixed(2)}`
                : `$${latestStatic.mstr_close.toFixed(2)} (static)`
              }
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
          <p className="text-xs text-red-400">
            ⚠ Live refresh failed: {error}. Showing static data as fallback.
          </p>
        </div>
      )}
    </div>
  )
}
