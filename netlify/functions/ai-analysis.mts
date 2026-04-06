import type { Context } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

// --- Rate Limiting (in-memory, resets on cold start / ~10 min idle) ---
const DAILY_LIMIT = 20; // max AI calls per day globally
const rateBucket: { date: string; count: number } = { date: '', count: 0 };

function checkRateLimit(): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (rateBucket.date !== today) {
    rateBucket.date = today;
    rateBucket.count = 0;
  }
  if (rateBucket.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  rateBucket.count++;
  return { allowed: true, remaining: DAILY_LIMIT - rateBucket.count };
}

// Language instructions for Claude
const LANG_MAP: Record<string, string> = {
  'zh-TW': 'Please respond entirely in Traditional Chinese (繁體中文).',
  'zh-CN': 'Please respond entirely in Simplified Chinese (简体中文).',
  'ja': 'Please respond entirely in Japanese (日本語).',
  'en': 'Please respond in English.',
};

export default async (req: Request, context: Context) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rate limit check
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "rate_limit",
        message: `Daily AI analysis limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Resets at midnight UTC.`,
        remaining: 0,
        max: DAILY_LIMIT,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse locale from query string
  const url = new URL(req.url);
  const locale = url.searchParams.get('locale') || 'en';
  const langInstruction = LANG_MAP[locale] || LANG_MAP['en'];

  try {
    // 1. Fetch live data
    const baseUrl = url.origin;
    const liveResp = await fetch(`${baseUrl}/.netlify/functions/live-data`);
    const liveData = await liveResp.json();

    if (!liveData.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not fetch live data" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Build prompt
    const mnavStr = liveData.mnav.value
      ? `${liveData.mnav.value}x (${liveData.mnav.premium_pct >= 0 ? "+" : ""}${liveData.mnav.premium_pct}% ${liveData.mnav.premium_pct >= 0 ? "premium" : "discount"})`
      : "unavailable (MSTR market closed)";

    const prompt = `You are a professional crypto-equity analyst. Provide a concise market analysis based on the following REAL-TIME data for Strategy Inc (MSTR), a Digital Asset Treasury company.

${langInstruction}

LIVE DATA (as of ${liveData.timestamp}):
- BTC Price: $${liveData.btc.price.toLocaleString()} (24h change: ${liveData.btc.change_24h_pct}%)
- MSTR Stock Price: ${liveData.mstr.price ? "$" + liveData.mstr.price.toFixed(2) : "market closed"}
- MSTR Market Cap: ${liveData.mstr.market_cap ? "$" + (liveData.mstr.market_cap / 1e9).toFixed(1) + "B" : "N/A"}
- BTC Holdings: ${liveData.holdings.btc.toLocaleString()} BTC (as of ${liveData.holdings.as_of})
- Bitcoin NAV: $${(liveData.holdings.btc_nav / 1e9).toFixed(1)}B
- Current mNAV: ${mnavStr}
- Diluted Shares: ${(liveData.mstr.shares_diluted / 1e6).toFixed(0)}M

CONTEXT:
- mNAV = Market Cap / (BTC Holdings × BTC Price)
- mNAV > 1.0 = premium, < 1.0 = discount
- MSTR peaked at ~2.25x mNAV in May 2025, declining since
- mNAV dropped below 1.0x in late 2025

Provide your analysis in exactly this JSON format (no markdown, pure JSON):
{
  "headline": "One-line market summary (max 15 words)",
  "sections": [
    {"title": "Current Valuation", "icon": "📊", "text": "2-3 sentences about current mNAV level"},
    {"title": "Market Dynamics", "icon": "📈", "text": "2-3 sentences about BTC price action and MSTR"},
    {"title": "Risk Assessment", "icon": "⚠️", "text": "2-3 sentences about key risks"},
    {"title": "Outlook", "icon": "🔮", "text": "2-3 sentences about potential scenarios"}
  ],
  "data_quality": "Real-time" or "Partial"
}

IMPORTANT: Every sentence must reference at least one specific number from the data above.`;

    // 3. Call Claude Haiku
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      analysis = { headline: "Analysis generated", raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        model: "claude-3-haiku-20240307",
        locale,
        analysis,
        live_data_used: {
          btc_price: liveData.btc.price,
          mnav: liveData.mnav.value,
          mstr_price: liveData.mstr.price,
        },
        rate_limit: { remaining: rateCheck.remaining, max: DAILY_LIMIT },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
