const { onRequest } = require("firebase-functions/v2/https");

// --- Constants ---
const BTC_HOLDINGS = 762099;
const HOLDINGS_DATE = "2026-03-23";
const SHARES_HISTORY = [
  { date: "2025-06-30", shares: 314000000 },
  { date: "2025-09-30", shares: 320000000 },
  { date: "2025-12-31", shares: 346000000 },
  { date: "2026-03-31", shares: 378000000 },
];

function getShares(d) {
  for (let i = SHARES_HISTORY.length - 1; i >= 0; i--)
    if (d >= SHARES_HISTORY[i].date) return SHARES_HISTORY[i].shares;
  return SHARES_HISTORY[0].shares;
}

// --- Rate Limit ---
const DAILY_LIMIT = 20;
const bucket = { date: "", count: 0 };
function checkRate() {
  const today = new Date().toISOString().slice(0, 10);
  if (bucket.date !== today) { bucket.date = today; bucket.count = 0; }
  if (bucket.count >= DAILY_LIMIT) return { ok: false, remaining: 0 };
  bucket.count++;
  return { ok: true, remaining: DAILY_LIMIT - bucket.count };
}

// ======= LIVE DATA =======
exports.livedata = onRequest({ cors: true, region: "asia-east1" }, async (req, res) => {
  try {
    const btcResp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
    );
    const btcJson = await btcResp.json();
    const btcPrice = btcJson.bitcoin.usd;
    const btc24h = btcJson.bitcoin.usd_24h_change;

    let mstrPrice = null, mstrMcap = null;
    try {
      const yResp = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=1d",
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (yResp.ok) {
        const y = await yResp.json();
        mstrPrice = y.chart.result[0].meta.regularMarketPrice;
        const today = new Date().toISOString().slice(0, 10);
        mstrMcap = mstrPrice * getShares(today);
      }
    } catch {}

    const btcNav = BTC_HOLDINGS * btcPrice;
    const today = new Date().toISOString().slice(0, 10);
    let mnav = null, premPct = null;
    if (mstrMcap) {
      mnav = +(mstrMcap / btcNav).toFixed(4);
      premPct = +((mnav - 1) * 100).toFixed(2);
    }

    res.set("Cache-Control", "public, max-age=60");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      btc: { price: btcPrice, change_24h_pct: btc24h ? +btc24h.toFixed(2) : null },
      mstr: { price: mstrPrice, market_cap: mstrMcap, shares_diluted: getShares(today) },
      holdings: { btc: BTC_HOLDINGS, as_of: HOLDINGS_DATE, btc_nav: btcNav },
      mnav: { value: mnav, premium_pct: premPct, note: mstrPrice ? "Live BTC + MSTR" : "BTC only" },
    });
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
});

// ======= AI ANALYSIS (Gemini 2.5 Flash — free, no billing) =======
exports.aianalysis = onRequest({ cors: true, region: "asia-east1", secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: "No GEMINI_API_KEY" });

  const rate = checkRate();
  if (!rate.ok) return res.status(429).json({ success: false, error: "rate_limit", remaining: 0, max: DAILY_LIMIT });

  const locale = req.query.locale || "en";
  const langMap = {
    "zh-TW": "Please respond entirely in Traditional Chinese (繁體中文).",
    "zh-CN": "Please respond entirely in Simplified Chinese (简体中文).",
    ja: "Please respond entirely in Japanese (日本語).",
    en: "Please respond in English.",
  };

  try {
    // Fetch BTC + MSTR directly
    const btcResp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
    const btcJson = await btcResp.json();
    const btcPrice = btcJson.bitcoin?.usd || 0;

    let mstrPrice = null;
    try {
      const yResp = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } });
      if (yResp.ok) { const y = await yResp.json(); mstrPrice = y.chart.result[0].meta.regularMarketPrice; }
    } catch {}

    const today = new Date().toISOString().slice(0, 10);
    const shares = getShares(today);
    const mstrMcap = mstrPrice ? mstrPrice * shares : null;
    const btcNav = BTC_HOLDINGS * btcPrice;
    const mnav = mstrMcap ? +(mstrMcap / btcNav).toFixed(4) : null;

    const liveData = {
      btc: { price: btcPrice, change_24h_pct: btcJson.bitcoin?.usd_24h_change?.toFixed(2) },
      mstr: { price: mstrPrice, market_cap: mstrMcap, shares_diluted: shares },
      mnav: { value: mnav, premium_pct: mnav ? +((mnav - 1) * 100).toFixed(2) : null },
      holdings: { btc: BTC_HOLDINGS, btc_nav: btcNav },
    };

    const prompt = `You are a professional crypto-equity analyst. ${langMap[locale] || langMap.en}

LIVE DATA:
- BTC: $${btcPrice.toLocaleString()}
- MSTR: ${mstrPrice ? "$" + mstrPrice : "closed"}
- mNAV: ${mnav ? mnav + "x" : "N/A"}
- Holdings: ${BTC_HOLDINGS.toLocaleString()} BTC
- NAV: $${(btcNav / 1e9).toFixed(1)}B

Respond in this exact JSON (no markdown, no code blocks):
{"headline":"summary max 15 words","sections":[{"title":"Current Valuation","icon":"📊","text":"2-3 sentences"},{"title":"Market Dynamics","icon":"📈","text":"2-3 sentences"},{"title":"Risk Assessment","icon":"⚠️","text":"2-3 sentences"},{"title":"Outlook","icon":"🔮","text":"2-3 sentences"}],"data_quality":"Real-time"}

Every sentence MUST reference a specific number from the data.`;

    // Call Gemini 2.5 Flash (free)
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const geminiJson = await geminiResp.json();

    if (geminiJson.error) throw new Error(geminiJson.error.message);

    const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let analysis;
    try { analysis = JSON.parse(text.match(/\{[\s\S]*\}/)[0]); } catch { analysis = { headline: text.slice(0, 100) }; }

    res.set("Cache-Control", "public, max-age=300");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      model: "gemini-2.5-flash",
      locale,
      analysis,
      live_data_used: { btc_price: btcPrice, mnav, mstr_price: mstrPrice },
      rate_limit: { remaining: rate.remaining, max: DAILY_LIMIT },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
