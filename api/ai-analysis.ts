type VercelRequest = any
type VercelResponse = any
import Anthropic from '@anthropic-ai/sdk'

const DAILY_LIMIT = 20
const rateBucket: { date: string; count: number } = { date: '', count: 0 }

function checkRateLimit(): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10)
  if (rateBucket.date !== today) { rateBucket.date = today; rateBucket.count = 0 }
  if (rateBucket.count >= DAILY_LIMIT) return { allowed: false, remaining: 0 }
  rateBucket.count++
  return { allowed: true, remaining: DAILY_LIMIT - rateBucket.count }
}

const LANG_MAP: Record<string, string> = {
  'zh-TW': 'Please respond entirely in Traditional Chinese (繁體中文).',
  'zh-CN': 'Please respond entirely in Simplified Chinese (简体中文).',
  'ja': 'Please respond entirely in Japanese (日本語).',
  'en': 'Please respond in English.',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=300')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' })

  const rateCheck = checkRateLimit()
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false, error: 'rate_limit',
      message: `Daily limit reached (${DAILY_LIMIT}/${DAILY_LIMIT})`,
      remaining: 0, max: DAILY_LIMIT,
    })
  }

  const locale = (req.query.locale as string) || 'en'
  const langInstruction = LANG_MAP[locale] || LANG_MAP['en']

  try {
    // Fetch live data from our own API
    const host = req.headers.host || 'dat-mnav-dashboard.vercel.app'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const liveResp = await fetch(`${protocol}://${host}/api/live-data`)
    const liveData = await liveResp.json()
    if (!liveData.success) return res.status(502).json({ success: false, error: 'Could not fetch live data' })

    const mnavStr = liveData.mnav.value
      ? `${liveData.mnav.value}x (${liveData.mnav.premium_pct >= 0 ? '+' : ''}${liveData.mnav.premium_pct}% ${liveData.mnav.premium_pct >= 0 ? 'premium' : 'discount'})`
      : 'unavailable (MSTR market closed)'

    const prompt = `You are a professional crypto-equity analyst. Provide a concise market analysis based on the following REAL-TIME data for Strategy Inc (MSTR).

${langInstruction}

LIVE DATA (as of ${liveData.timestamp}):
- BTC Price: $${liveData.btc.price.toLocaleString()} (24h: ${liveData.btc.change_24h_pct}%)
- MSTR Stock: ${liveData.mstr.price ? '$' + liveData.mstr.price.toFixed(2) : 'closed'}
- Market Cap: ${liveData.mstr.market_cap ? '$' + (liveData.mstr.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
- BTC Holdings: ${liveData.holdings.btc.toLocaleString()} BTC
- Bitcoin NAV: $${(liveData.holdings.btc_nav / 1e9).toFixed(1)}B
- mNAV: ${mnavStr}
- Diluted Shares: ${(liveData.mstr.shares_diluted / 1e6).toFixed(0)}M

CONTEXT: mNAV = Market Cap / (BTC Holdings × BTC Price). >1.0 = premium, <1.0 = discount. MSTR peaked ~2.25x in May 2025, now in discount territory.

Respond in this exact JSON format (no markdown):
{
  "headline": "One-line summary (max 15 words)",
  "sections": [
    {"title": "Current Valuation", "icon": "📊", "text": "2-3 sentences"},
    {"title": "Market Dynamics", "icon": "📈", "text": "2-3 sentences"},
    {"title": "Risk Assessment", "icon": "⚠️", "text": "2-3 sentences"},
    {"title": "Outlook", "icon": "🔮", "text": "2-3 sentences"}
  ],
  "data_quality": "Real-time" or "Partial"
}

Every sentence MUST reference a specific number from the data.`

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let analysis
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch { analysis = { headline: 'Analysis generated', raw: responseText } }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      model: 'claude-3-haiku-20240307',
      locale,
      analysis,
      live_data_used: { btc_price: liveData.btc.price, mnav: liveData.mnav.value, mstr_price: liveData.mstr.price },
      rate_limit: { remaining: rateCheck.remaining, max: DAILY_LIMIT },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
