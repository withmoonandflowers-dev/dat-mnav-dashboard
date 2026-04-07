import { useEffect, useState } from 'react'
import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

interface LiveData {
  btcPrice: number
  btc24hChange: number | null
  mstrPrice: number | null
  timestamp: string
  source: string
}

interface Props {
  latestStatic: DataPoint
}

export default function LiveRefresh({ latestStatic }: Props) {
  const { locale } = useLocale()
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState<LiveData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLive = async () => {
    setLoading(true)
    setError(null)
    try {
      // CoinGecko — free, CORS-friendly, no key needed
      const resp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      )
      if (!resp.ok) throw new Error(`CoinGecko: ${resp.status}`)
      const json = await resp.json()
      const btcPrice = json.bitcoin?.usd
      if (!btcPrice) throw new Error('Invalid BTC data')

      // Try MSTR from a CORS-friendly proxy (may fail)
      let mstrPrice: number | null = null
      try {
        const yResp = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=1d'
        )
        if (yResp.ok) {
          const yJson = await yResp.json()
          mstrPrice = yJson.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
        }
      } catch {
        // Expected: Yahoo Finance blocks browser CORS
      }

      setLive({
        btcPrice,
        btc24hChange: json.bitcoin?.usd_24h_change ? +json.bitcoin.usd_24h_change.toFixed(2) : null,
        mstrPrice,
        timestamp: new Date().toISOString(),
        source: mstrPrice ? 'CoinGecko + Yahoo Finance' : 'CoinGecko (BTC)',
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLive() }, [])

  // Compute live mNAV estimate
  const liveMnav = live
    ? latestStatic.mstr_market_cap / (latestStatic.btc_holdings * live.btcPrice)
    : null
  const livePremiumPct = liveMnav ? (liveMnav - 1) * 100 : null
  const isPremium = (liveMnav ?? 0) >= 1
  const isLive = !!live

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            loading ? 'bg-yellow-500 animate-pulse' :
            isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <div>
            <p className="text-sm font-medium">
              {loading ? t(locale, 'live.connecting') :
               isLive ? `● ${t(locale, 'live.title')}` : `○ ${t(locale, 'live.fallback')}`}
            </p>
            <p className="text-xs text-gray-500">
              {loading ? t(locale, 'live.fetchingDesc') :
               isLive ? `${new Date(live!.timestamp).toLocaleString()} · ${live!.source}` :
               `${t(locale, 'live.staticFallback')} ${latestStatic.date}. ${error || ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchLive}
          disabled={loading}
          className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {loading ? t(locale, 'live.refreshing') : t(locale, 'live.refresh')}
        </button>
      </div>

      {isLive && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a] grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.liveMnav')}</p>
            <p className={`text-xl font-bold ${isPremium ? 'text-green-400' : 'text-red-400'}`}>
              {liveMnav ? `${liveMnav.toFixed(2)}x` : 'N/A'}
            </p>
            <p className="text-xs text-gray-600">
              {livePremiumPct != null
                ? `${livePremiumPct >= 0 ? '+' : ''}${livePremiumPct.toFixed(1)}% ${isPremium ? t(locale, 'live.premium') : t(locale, 'live.discount')}`
                : ''}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.liveBtc')}</p>
            <p className="text-white font-semibold">
              ${live!.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className={`text-xs ${(live!.btc24hChange ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {live!.btc24hChange != null ? `${live!.btc24hChange >= 0 ? '+' : ''}${live!.btc24hChange}% 24h` : ''}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.mstrPrice')}</p>
            <p className="text-white font-semibold">
              {live!.mstrPrice ? `$${live!.mstrPrice.toFixed(2)}` : `$${latestStatic.mstr_close.toFixed(2)} (static)`}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.holdings')}</p>
            <p className="text-orange-400 font-semibold">{latestStatic.btc_holdings.toLocaleString()}</p>
            <p className="text-xs text-gray-600">{t(locale, 'live.asOf')} 2026-03-23</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.btcNav')}</p>
            <p className="text-orange-400 font-semibold">
              ${((latestStatic.btc_holdings * live!.btcPrice) / 1e9).toFixed(1)}B
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
