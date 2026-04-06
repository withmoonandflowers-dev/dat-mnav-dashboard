import type { Context } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

export default async (req: Request, context: Context) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Fetch live data from our own live-data function
    const baseUrl = new URL(req.url).origin;
    const liveResp = await fetch(`${baseUrl}/.netlify/functions/live-data`);
    const liveData = await liveResp.json();

    if (!liveData.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not fetch live data" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Build prompt with real data
    const mnavStr = liveData.mnav.value
      ? `${liveData.mnav.value}x (${liveData.mnav.premium_pct >= 0 ? "+" : ""}${liveData.mnav.premium_pct}% ${liveData.mnav.premium_pct >= 0 ? "premium" : "discount"})`
      : "unavailable (MSTR market closed)";

    const prompt = `You are a professional crypto-equity analyst. Provide a concise market analysis based on the following REAL-TIME data for Strategy Inc (MSTR), a Digital Asset Treasury company.

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
- mNAV > 1.0 = premium (market values company above its BTC), < 1.0 = discount
- MSTR peaked at ~2.25x mNAV in May 2025, has been declining since
- mNAV dropped below 1.0x in late 2025, currently in discount territory
- MSTR acts as leveraged BTC exposure with beta ~1.3-1.4x

Provide your analysis in exactly this JSON format (no markdown, pure JSON):
{
  "headline": "One-line market summary (max 15 words)",
  "sections": [
    {"title": "Current Valuation", "icon": "📊", "text": "2-3 sentences about current mNAV level and what it means"},
    {"title": "Market Dynamics", "icon": "📈", "text": "2-3 sentences about BTC price action and MSTR correlation"},
    {"title": "Risk Assessment", "icon": "⚠️", "text": "2-3 sentences about key risks at current levels"},
    {"title": "Outlook", "icon": "🔮", "text": "2-3 sentences about potential scenarios ahead"}
  ],
  "data_quality": "Real-time" or "Partial (MSTR market closed)"
}

IMPORTANT: Every sentence must reference at least one specific number from the data above. Do not use generic language.`;

    // 3. Call Claude Haiku (cheapest, fastest)
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    // 4. Parse response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let analysis;
    try {
      // Extract JSON from response (Claude sometimes wraps in markdown)
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
        analysis,
        live_data_used: {
          btc_price: liveData.btc.price,
          mnav: liveData.mnav.value,
          mstr_price: liveData.mstr.price,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache 5 min to limit API costs
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
