import { useState } from 'react'

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
  error?: string
}

export default function AiSummary() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      const resp = await fetch('/.netlify/functions/ai-analysis')
      const json: AiResponse = await resp.json()
      if (json.success) {
        setData(json)
      } else {
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
            <h2 className="text-lg font-semibold">AI Market Analysis</h2>
            <p className="text-xs text-gray-500">
              {hasLiveAi
                ? `Live analysis by ${data!.model} · ${new Date(data!.timestamp).toLocaleString()}`
                : hasStaticAi
                  ? `Pre-generated analysis · ${new Date(staticData.generated_at).toLocaleDateString()}`
                  : 'Click to generate real-time analysis with Claude AI'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchAi}
          disabled={loading}
          className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Claude is analyzing...
            </>
          ) : hasLiveAi ? (
            '↻ Re-analyze'
          ) : (
            '⚡ Generate Live AI Analysis'
          )}
        </button>
      </div>

      {/* Live AI headline */}
      {hasLiveAi && data!.analysis.headline && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
          <p className="text-purple-300 font-medium">{data!.analysis.headline}</p>
          <p className="text-xs text-gray-500 mt-1">
            Based on BTC ${data!.live_data_used.btc_price?.toLocaleString()} | mNAV {data!.live_data_used.mnav?.toFixed(2)}x | Data: {data!.analysis.data_quality}
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
            ↑ Pre-generated static analysis. Click "Generate Live AI Analysis" for real-time Claude analysis.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!hasLiveAi && !hasStaticAi && !loading && !error && (
        <p className="text-sm text-gray-500 text-center py-4">
          Click the button above to generate a real-time AI analysis using Claude
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3">
          <p className="text-xs text-red-400">⚠ {error}</p>
          <p className="text-xs text-gray-500 mt-1">
            {hasStaticAi ? 'Showing pre-generated analysis above as fallback.' : 'Static fallback analysis shown if available.'}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-700 mt-3">
        Powered by Anthropic Claude API · Not financial advice · Cached 5 min
      </p>
    </div>
  )
}
