import { useEffect, useState, useMemo } from 'react'
import type { MnavData } from './types'
import { t } from './i18n'
import { LocaleProvider, useLocale, LocaleSwitcher } from './components/LocaleContext'
import DashboardCards from './components/DashboardCards'
import MnavChart from './components/MnavChart'
import BtcChart from './components/BtcChart'
import CorrelationChart from './components/CorrelationChart'
import StatsTable from './components/StatsTable'
import AiSummary from './components/AiSummary'
import LiveRefresh from './components/LiveRefresh'
import DateRangeSelector, { type DateRange, getCutoffDate } from './components/DateRangeSelector'

function Dashboard() {
  const { locale } = useLocale()
  const [mnavData, setMnavData] = useState<MnavData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('all')

  useEffect(() => {
    fetch('/data/mnav_timeseries.json')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(data => { setMnavData(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!mnavData) return []
    const { data } = mnavData
    if (data.length === 0) return data
    const cutoff = getCutoffDate(dateRange, data[data.length - 1].date)
    if (!cutoff) return data
    return data.filter(d => d.date >= cutoff)
  }, [mnavData, dateRange])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error || !mnavData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        <p>{error}</p>
      </div>
    )
  }

  const { metadata } = mnavData

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-black text-sm">D</div>
            <div>
              <h1 className="text-lg font-bold">{t(locale, 'header.title')}</h1>
              <p className="text-xs text-gray-500">{t(locale, 'header.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Strategy (MSTR)</p>
              <p className="text-xs text-gray-400">{metadata.total_data_points} {t(locale, 'header.dataPoints')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <LiveRefresh latestStatic={mnavData.data[mnavData.data.length - 1]} />

        {/* Date Range Selector */}
        <div className="flex items-center justify-between mb-4">
          <DateRangeSelector selected={dateRange} onSelect={setDateRange} />
          <span className="text-xs text-gray-500">
            {filteredData.length} / {mnavData.data.length} {t(locale, 'header.dataPoints')}
          </span>
        </div>

        <DashboardCards data={filteredData} />
        <MnavChart data={filteredData} />
        <BtcChart data={filteredData} />
        <CorrelationChart data={filteredData} />
        <StatsTable data={filteredData} />
        <AiSummary />

        {/* Methodology */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">{t(locale, 'method.title')}</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
            <div>
              <h3 className="text-white font-medium mb-2">{t(locale, 'method.whatIs')}</h3>
              <p className="mb-2">{t(locale, 'method.whatIsText')}</p>
              <p>
                <span className="text-green-400">mNAV &gt; 1.0</span> {t(locale, 'method.premiumNote')}{' '}
                <span className="text-red-400">mNAV &lt; 1.0</span> {t(locale, 'method.discountNote')}
              </p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">{t(locale, 'method.dataSources')}</h3>
              <ul className="space-y-1">
                <li><span className="text-orange-400">BTC:</span> {metadata.data_sources.btc_price}</li>
                <li><span className="text-orange-400">MSTR:</span> {metadata.data_sources.mstr_stock}</li>
                <li><span className="text-orange-400">Holdings:</span> {metadata.data_sources.btc_holdings}</li>
              </ul>
              <h3 className="text-white font-medium mt-4 mb-2">{t(locale, 'method.architecture')}</h3>
              <ul className="space-y-1 text-xs">
                <li><span className="text-green-400">Layer 1:</span> {t(locale, 'method.layer1')}</li>
                <li><span className="text-green-400">Layer 2:</span> {t(locale, 'method.layer2')}</li>
                <li><span className="text-green-400">Layer 3:</span> {t(locale, 'method.layer3')}</li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 text-xs text-gray-600 border-t border-[#1a1a1a]">
          <p>DAT.co mNAV Dashboard · {t(locale, 'footer.built')} · {new Date(metadata.generated_at).toLocaleDateString()}</p>
          <p className="mt-1">{t(locale, 'footer.notAdvice')}</p>
        </footer>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <LocaleProvider>
      <Dashboard />
    </LocaleProvider>
  )
}
