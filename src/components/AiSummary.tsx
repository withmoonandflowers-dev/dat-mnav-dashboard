import { useState } from 'react'
import { t } from '../i18n'
import { useLocale } from './LocaleContext'

interface AiSection {
  title: string
  icon: string
  text: string
}

interface AiResponse {
  success: boolean
  timestamp: string
  model: string
  analysis: {
    headline: string
    sections: AiSection[]
    data_quality: string
  }
  live_data_used: {
    btc_price: number
    mnav: number | null
    mstr_price: number | null
  }
  rate_limit?: {
    remaining: number
    max: number
  }
  error?: string
}

export default function AiSummary() {
  const { locale } = useLocale()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<{ remaining: number; max: number } | null>(null)

  // Also try to load static fallback
  const [staticData, setStaticData] = useState<any>(null)
  useState(() => {
    fetch('/data/ai_summary.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => setStaticData(d))
      .catch(() => {})
  })

  const fetchAi = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/.netlify/functions/ai-analysis?locale=' + locale)
      const json: AiResponse = await resp.json()
      if (json.rate_limit) {
        setRateLimit(json.rate_limit)
      }
      if (json.success) {
        setData(json)
      } else {
        if (json.error === 'rate_limit') {
          const max = json.rate_limit?.max ?? 0
          throw new Error(t(locale, 'ai.rateLimitHit', { max }))
        }
        throw new Error(json.error || 'AI analysis failed')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Show static analysis as default, live AI as upgrade
  const hasLiveAi = data?.success && data.analysis?.sections
  const hasStaticAi = staticData?.analysis

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/50 rounded-lg flex items-center justify-center text-sm">
            🤖
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t(locale, 'ai.title')}</h2>
            <p className="text-xs text-gray-500">
              {hasLiveAi
                ? `${t(locale, 'ai.liveBy')} ${data!.model} · ${new Date(data!.timestamp).toLocaleString()}`
                : hasStaticAi
                  ? `${t(locale, 'ai.preGenerated')} · ${new Date(staticData.generated_at).toLocaleDateString()}`
                  : t(locale, 'ai.clickToGenerate')}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={fetchAi}
            disabled={loading}
            className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                {t(locale, 'ai.analyzing')}
              </>
            ) : hasLiveAi ? (
              t(locale, 'ai.reAnalyze')
            ) : (
              t(locale, 'ai.generate')
            )}
          </button>
          {rateLimit && (
            <p className="text-xs text-gray-600">
              {t(locale, 'ai.rateLimit', { remaining: rateLimit.remaining, max: rateLimit.max })}
            </p>
          )}
        </div>
      </div>

      {/* Live AI headline */}
      {hasLiveAi && data!.analysis.headline && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
          <p className="text-purple-300 font-medium">{data!.analysis.headline}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t(locale, 'ai.basedOn')} BTC ${data!.live_data_used.btc_price?.toLocaleString()} | mNAV {data!.live_data_used.mnav?.toFixed(2)}x | {t(locale, 'ai.data')}: {data!.analysis.data_quality}
          </p>
        </div>
      )}

      {/* Live AI sections */}
      {hasLiveAi && (
        <div className="space-y-3">
          {data!.analysis.sections.map((s, i) => (
            <div key={i} className="bg-[#0a0a0a] rounded-lg p-4">
              <h3 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                <span>{s.icon}</span>{s.title}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Static fallback */}
      {!hasLiveAi && hasStaticAi && (
        <div className="space-y-3">
          {Object.entries(staticData.analysis as Record<string, string>).map(([key, text]) => (
            <div key={key} className="bg-[#0a0a0a] rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{text}</p>
            </div>
          ))}
          <p className="text-xs text-gray-600 italic">
            {t(locale, 'ai.staticNote')}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!hasLiveAi && !hasStaticAi && !loading && !error && (
        <p className="text-sm text-gray-500 text-center py-4">
          {t(locale, 'ai.clickAbove')}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3">
          <p className="text-xs text-red-400">⚠ {error}</p>
          <p className="text-xs text-gray-500 mt-1">
            {hasStaticAi ? t(locale, 'ai.staticNote') : ''}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-700 mt-3">
        {t(locale, 'ai.poweredBy')}
      </p>
    </div>
  )
}
