import { useEffect, useState } from 'react'
import type { DataPoint } from '../types'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

interface LiveApiResponse {
  success: boolean
  timestamp: string
  btc: { price: number; change_24h_pct: number | null }
  mstr: { price: number | null; market_cap: number | null; shares_diluted: number }
  holdings: { btc: number; as_of: string; btc_nav: number }
  mnav: { value: number | null; premium_pct: number | null; note: string }
  sources: Record<string, string>
  error?: string
}

interface Props {
  latestStatic: DataPoint
}

export default function LiveRefresh({ latestStatic }: Props) {
  const { locale } = useLocale()
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState<LiveApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLive = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/live-data')
      const data: LiveApiResponse = await resp.json()
      if (data.success) {
        setLive(data)
      } else {
        throw new Error(data.error || 'API error')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => { fetchLive() }, [])

  const isLive = live?.success
  const mnav = live?.mnav.value
  const isPremium = (mnav ?? 0) >= 1

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 mb-6">
      {/* Status bar */}
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
               isLive ? `${new Date(live!.timestamp).toLocaleString()} · ${live!.mnav.note}` :
               `Static data as of ${latestStatic.date}. ${error}`}
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

      {/* Live data cards */}
      {isLive && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a] grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.liveMnav')}</p>
            <p className={`text-xl font-bold ${isPremium ? 'text-green-400' : 'text-red-400'}`}>
              {mnav ? `${mnav.toFixed(2)}x` : 'N/A'}
            </p>
            <p className="text-xs text-gray-600">
              {live!.mnav.premium_pct != null
                ? `${live!.mnav.premium_pct >= 0 ? '+' : ''}${live!.mnav.premium_pct}% ${isPremium ? t(locale, 'live.premium') : t(locale, 'live.discount')}`
                : ''}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.liveBtc')}</p>
            <p className="text-white font-semibold">
              ${live!.btc.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className={`text-xs ${(live!.btc.change_24h_pct ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {live!.btc.change_24h_pct != null ? `${live!.btc.change_24h_pct >= 0 ? '+' : ''}${live!.btc.change_24h_pct}% 24h` : ''}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.mstrPrice')}</p>
            <p className="text-white font-semibold">
              {live!.mstr.price ? `$${live!.mstr.price.toFixed(2)}` : t(locale, 'live.mstrClosed')}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.holdings')}</p>
            <p className="text-orange-400 font-semibold">{live!.holdings.btc.toLocaleString()}</p>
            <p className="text-xs text-gray-600">{t(locale, 'live.asOf')} {live!.holdings.as_of}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t(locale, 'live.btcNav')}</p>
            <p className="text-orange-400 font-semibold">${(live!.holdings.btc_nav / 1e9).toFixed(1)}B</p>
          </div>
        </div>
      )}
    </div>
  )
}
