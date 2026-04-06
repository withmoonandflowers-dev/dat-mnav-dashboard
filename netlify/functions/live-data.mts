import type { Context } from "@netlify/functions";

// --- MSTR BTC Holdings (updated per purchase event) ---
// Source: strategy.com/purchases — last confirmed: 2026-03-23
const LATEST_BTC_HOLDINGS = 762_099;
const HOLDINGS_DATE = "2026-03-23";

// --- Diluted Shares (quarterly interpolated from SEC filings + StrategyTracker) ---
const SHARES_HISTORY = [
  { date: "2025-06-30", shares: 314_000_000 },
  { date: "2025-09-30", shares: 320_000_000 },
  { date: "2025-12-31", shares: 346_000_000 },
  { date: "2026-03-31", shares: 378_000_000 },
];

function getSharesForDate(dateStr: string): number {
  for (let i = SHARES_HISTORY.length - 1; i >= 0; i--) {
    if (dateStr >= SHARES_HISTORY[i].date) return SHARES_HISTORY[i].shares;
  }
  return SHARES_HISTORY[0].shares;
}

export default async (req: Request, context: Context) => {
  try {
    // 1. Fetch BTC price from CoinGecko (free, no key)
    const btcResp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true"
    );
    if (!btcResp.ok) throw new Error(`CoinGecko: ${btcResp.status}`);
    const btcData = await btcResp.json();
    const btcPrice = btcData.bitcoin.usd;
    const btc24hChange = btcData.bitcoin.usd_24h_change;

    // 2. Fetch MSTR stock price from Yahoo Finance
    let mstrPrice: number | null = null;
    let mstrMarketCap: number | null = null;
    try {
      const yResp = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=1d",
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (yResp.ok) {
        const yData = await yResp.json();
        const meta = yData.chart.result[0].meta;
        mstrPrice = meta.regularMarketPrice;
        const today = new Date().toISOString().slice(0, 10);
        const shares = getSharesForDate(today);
        mstrMarketCap = mstrPrice! * shares;
      }
    } catch {
      // Yahoo Finance may fail — use last known static data as fallback
    }

    // 3. Compute mNAV
    const btcNav = LATEST_BTC_HOLDINGS * btcPrice;
    const today = new Date().toISOString().slice(0, 10);
    const shares = getSharesForDate(today);

    let mnav: number | null = null;
    let premiumPct: number | null = null;
    if (mstrMarketCap) {
      mnav = mstrMarketCap / btcNav;
      premiumPct = (mnav - 1) * 100;
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        btc: {
          price: btcPrice,
          change_24h_pct: btc24hChange ? +btc24hChange.toFixed(2) : null,
        },
        mstr: {
          price: mstrPrice,
          market_cap: mstrMarketCap,
          shares_diluted: shares,
        },
        holdings: {
          btc: LATEST_BTC_HOLDINGS,
          as_of: HOLDINGS_DATE,
          btc_nav: btcNav,
        },
        mnav: {
          value: mnav ? +mnav.toFixed(4) : null,
          premium_pct: premiumPct ? +premiumPct.toFixed(2) : null,
          note: mstrPrice
            ? "Computed from live BTC + MSTR prices"
            : "BTC price live, MSTR unavailable (market closed?)",
        },
        sources: {
          btc_price: "CoinGecko API (real-time)",
          mstr_price: mstrPrice ? "Yahoo Finance v8 (real-time)" : "unavailable",
          holdings: "strategy.com/purchases (manual, updated per 8-K)",
          shares: "SEC filings + StrategyTracker.com (quarterly)",
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        fallback: "Use /data/mnav_timeseries.json for static data",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
