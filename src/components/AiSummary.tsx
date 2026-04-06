import { useEffect, useState } from 'react'

interface AiSummaryData {
  generated_at: string
  analysis: Record<string, string>
  key_metrics: Record<string, number | string>
}

const SECTION_TITLES: Record<string, string> = {
  current_status: 'Current Status',
  trend_analysis: '30-Day Trend',
  historical_context: 'Historical Context',
  investor_implications: 'Investor Implications',
  correlation_insight: 'BTC Correlation',
}

const SECTION_ICONS: Record<string, string> = {
  current_status: '📊',
  trend_analysis: '📈',
  historical_context: '📅',
  investor_implications: '💡',
  correlation_insight: '🔗',
}

export default function AiSummary() {
  const [data, setData] = useState<AiSummaryData | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    fetch('/data/ai_summary.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
  }, [])

  if (!data) return null

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/50 rounded-lg flex items-center justify-center text-sm">
            🤖
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI-Generated Market Analysis</h2>
            <p className="text-xs text-gray-500">
              Auto-generated from mNAV time-series data &middot;{' '}
              {new Date(data.generated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className="text-gray-500 text-xl">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {Object.entries(data.analysis).map(([key, text]) => (
            <div key={key} className="bg-[#0a0a0a] rounded-lg p-4">
              <h3 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                <span>{SECTION_ICONS[key] || '📌'}</span>
                {SECTION_TITLES[key] || key}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
            </div>
          ))}

          <p className="text-xs text-gray-600 italic mt-2">
            Disclaimer: This analysis is auto-generated for educational purposes and
            does not constitute financial advice.
          </p>
        </div>
      )}
    </div>
  )
}
