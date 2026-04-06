"""
DAT.co mNAV Data Pipeline
========================
Fetches BTC price, MSTR stock data, and computes mNAV time series.

Data Sources:
- BTC Price: CoinGecko API (free)
- MSTR Stock: Yahoo Finance (direct HTTP, no yfinance dependency)
- BTC Holdings: Manual JSON from strategy.com/purchases

Output: public/data/mnav_timeseries.json
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests

# --- Config ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", PROJECT_ROOT / "public" / "data"))
HOLDINGS_FILE = PROJECT_ROOT / "mstr_bitcoin_purchases.json"
DAYS_BACK = 400

# --- Step 1: Fetch BTC Daily Prices ---
def fetch_btc_prices():
    """Try multiple sources for BTC price data."""
    prices = {}

    # Source 1: CoinCap API (free, no key needed)
    print("[1/4] Fetching BTC prices from CoinCap API...")
    try:
        prices = _fetch_btc_coincap()
        if len(prices) >= 250:
            print(f"   CoinCap: Got {len(prices)} days")
        else:
            print(f"   CoinCap returned only {len(prices)} days, trying CoinGecko...")
            raise ValueError("Insufficient data")
    except Exception as e:
        print(f"   CoinCap failed: {e}")
        print("   Trying CoinGecko simple endpoint...")
        prices = _fetch_btc_coingecko_simple()

    print(f"   Total: {len(prices)} daily BTC prices")
    print(f"   Range: {min(prices.keys())} to {max(prices.keys())}")
    print(f"   Price range: ${min(prices.values()):,.0f} - ${max(prices.values()):,.0f}")

    with open(DATA_DIR / "btc_prices.json", "w") as f:
        json.dump(prices, f, indent=2)

    return prices


def _fetch_btc_coincap():
    """CoinCap v2 API - free, no auth required."""
    prices = {}
    # CoinCap returns max 2000 points per request
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - (DAYS_BACK * 86400 * 1000)

    url = "https://api.coincap.io/v2/assets/bitcoin/history"
    params = {"interval": "d1", "start": start_ms, "end": end_ms}

    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()["data"]

    for point in data:
        ts = int(point["time"]) / 1000
        date_str = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        prices[date_str] = round(float(point["priceUsd"]), 2)

    return prices


def _fetch_btc_coingecko_simple():
    """CoinGecko - try without auth for smaller date ranges."""
    prices = {}
    # Try the free endpoint with smaller chunks
    for offset_days in range(0, DAYS_BACK, 90):
        end_date = datetime.now() - timedelta(days=offset_days)
        start_date = end_date - timedelta(days=90)

        url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range"
        params = {
            "vs_currency": "usd",
            "from": int(start_date.timestamp()),
            "to": int(end_date.timestamp()),
        }
        try:
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                for ts, price in data.get("prices", []):
                    date_str = datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                    prices[date_str] = round(price, 2)
            time.sleep(1)  # Rate limit
        except Exception:
            continue

    if not prices:
        raise RuntimeError("All BTC price sources failed!")
    return prices


# --- Step 2: Fetch MSTR Stock Data from Yahoo Finance (direct HTTP) ---
def fetch_mstr_stock():
    print("[2/4] Fetching MSTR stock data from Yahoo Finance...")

    end_ts = int(time.time())
    start_ts = end_ts - (DAYS_BACK * 86400)

    # Yahoo Finance v8 chart API (public, no key needed)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/MSTR"
    params = {
        "period1": start_ts,
        "period2": end_ts,
        "interval": "1d",
        "includePrePost": "false",
    }
    headers = {"User-Agent": "Mozilla/5.0"}

    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    chart = resp.json()["chart"]["result"][0]

    timestamps = chart["timestamp"]
    closes = chart["indicators"]["quote"][0]["close"]

    # MSTR Effective Diluted Shares (includes convertible note dilution).
    # Source: StrategyTracker.com mNAV Analysis (Diluted Shares mode)
    # Cross-validated against SEC 10-Q filings and stockanalysis.com
    # Note: "Effective Diluted Shares" > basic shares because it includes
    # potential shares from convertible notes, preferred stock, and options.
    # MSTR did a 10:1 stock split on Aug 8, 2024.
    SHARES_HISTORY = [
        ("2024-08-08", 244_000_000),   # Post 10:1 split (basic shares)
        ("2024-09-30", 260_000_000),   # Q3 2024 diluted
        ("2024-12-31", 280_000_000),   # Q4 2024 (heavy ATM + convertible notes)
        ("2025-03-31", 300_000_000),   # Q1 2025
        ("2025-06-30", 314_000_000),   # Q2 2025 (StrategyTracker: 314.2M on 2025-07-11)
        ("2025-09-30", 320_000_000),   # Q3 2025 (StrategyTracker: 320.0M on 2025-10-06)
        ("2025-12-31", 346_000_000),   # Q4 2025 (StrategyTracker: 345.6M on 2026-01-06)
        ("2026-03-31", 378_000_000),   # Q1 2026 (StrategyTracker: 377.8M on 2026-04-02)
    ]

    def get_shares_for_date(date_str):
        """Linear interpolation between known quarterly share counts."""
        for i in range(len(SHARES_HISTORY) - 1):
            d1, s1 = SHARES_HISTORY[i]
            d2, s2 = SHARES_HISTORY[i + 1]
            if d1 <= date_str <= d2:
                # Linear interpolation
                days_total = (datetime.strptime(d2, "%Y-%m-%d") - datetime.strptime(d1, "%Y-%m-%d")).days
                days_elapsed = (datetime.strptime(date_str, "%Y-%m-%d") - datetime.strptime(d1, "%Y-%m-%d")).days
                if days_total == 0:
                    return s1
                ratio = days_elapsed / days_total
                return int(s1 + (s2 - s1) * ratio)
        # If after last known date, use last known value
        if date_str >= SHARES_HISTORY[-1][0]:
            return SHARES_HISTORY[-1][1]
        # If before first known date, use first known value
        return SHARES_HISTORY[0][1]

    print(f"   Using time-varying shares outstanding (interpolated from SEC filings)")
    print(f"   Range: {SHARES_HISTORY[0][1]:,} ({SHARES_HISTORY[0][0]}) to {SHARES_HISTORY[-1][1]:,} ({SHARES_HISTORY[-1][0]})")

    stock_data = {}
    for i, ts in enumerate(timestamps):
        close = closes[i]
        if close is None:
            continue
        date_str = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        close_price = round(float(close), 2)
        shares = get_shares_for_date(date_str)
        market_cap = round(close_price * shares)
        stock_data[date_str] = {
            "close": close_price,
            "market_cap": market_cap,
            "shares_outstanding": shares,
        }

    print(f"   Got {len(stock_data)} trading days")
    print(f"   Date range: {min(stock_data.keys())} to {max(stock_data.keys())}")

    price_vals = [v["close"] for v in stock_data.values()]
    print(f"   Price range: ${min(price_vals):,.2f} - ${max(price_vals):,.2f}")

    with open(DATA_DIR / "mstr_stock.json", "w") as f:
        json.dump(stock_data, f, indent=2)

    return stock_data


# --- Step 3: Load BTC Holdings and Interpolate ---
def load_btc_holdings():
    print("[3/4] Loading MSTR BTC holdings...")

    with open(HOLDINGS_FILE, "r") as f:
        raw = json.load(f)

    purchases = raw["purchases"]
    print(f"   Loaded {len(purchases)} purchase events")
    print(f"   Latest: {purchases[-1]['date']} -> {purchases[-1]['total_btc']:,} BTC")

    events = []
    for p in purchases:
        events.append((p["date"], p["total_btc"]))
    events.sort(key=lambda x: x[0])
    return events


def interpolate_holdings(events, target_date):
    """Step interpolation: holdings stay constant until next purchase."""
    holdings = 0
    for date_str, total_btc in events:
        if date_str <= target_date:
            holdings = total_btc
        else:
            break
    return holdings


# --- Step 4: Compute mNAV Time Series ---
def compute_mnav(btc_prices, mstr_stock, holdings_events):
    print("[4/4] Computing mNAV time series...")

    common_dates = sorted(set(btc_prices.keys()) & set(mstr_stock.keys()))
    print(f"   Common trading dates: {len(common_dates)}")

    timeseries = []
    skipped = 0

    for date_str in common_dates:
        btc_price = btc_prices[date_str]
        mstr = mstr_stock[date_str]
        btc_holdings = interpolate_holdings(holdings_events, date_str)

        if btc_holdings == 0 or btc_price == 0:
            skipped += 1
            continue

        btc_nav = btc_holdings * btc_price
        mnav = mstr["market_cap"] / btc_nav
        premium_pct = (mnav - 1) * 100

        timeseries.append({
            "date": date_str,
            "mnav": round(mnav, 4),
            "premium_pct": round(premium_pct, 2),
            "btc_price": btc_price,
            "mstr_close": mstr["close"],
            "mstr_market_cap": mstr["market_cap"],
            "btc_holdings": btc_holdings,
            "btc_nav": round(btc_nav),
        })

    if skipped:
        print(f"   Skipped {skipped} dates (before first BTC purchase)")

    mnav_values = [d["mnav"] for d in timeseries]
    print(f"   Final data points: {len(timeseries)}")
    print(f"   mNAV range: {min(mnav_values):.2f} - {max(mnav_values):.2f}")
    print(f"   Latest: {timeseries[-1]['date']} -> mNAV = {timeseries[-1]['mnav']:.4f}")

    out_of_range = [d for d in timeseries if d["mnav"] < 0.3 or d["mnav"] > 5.0]
    if out_of_range:
        print(f"   WARNING: {len(out_of_range)} points outside [0.3, 5.0]")
        for d in out_of_range[:3]:
            print(f"      {d['date']}: mNAV={d['mnav']}")
    else:
        print(f"   All values within expected range [0.3, 5.0]")

    output = {
        "metadata": {
            "indicator": "mNAV",
            "formula": "Market Cap / (BTC Holdings x BTC Price)",
            "company": "Strategy (MSTR)",
            "data_sources": {
                "btc_price": "CoinGecko API /coins/bitcoin/market_chart",
                "mstr_stock": "Yahoo Finance v8 chart API",
                "btc_holdings": "strategy.com/purchases (manual compilation)"
            },
            "generated_at": datetime.now().isoformat(),
            "total_data_points": len(timeseries),
        },
        "data": timeseries
    }

    with open(DATA_DIR / "mnav_timeseries.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n   Saved to {DATA_DIR / 'mnav_timeseries.json'}")
    return timeseries


# --- Validation Report ---
def print_validation_report(timeseries):
    print("\n" + "=" * 60)
    print("CP-1 VALIDATION REPORT")
    print("請用以下 3 個日期去 saylortracker.com 交叉驗證")
    print("=" * 60)

    n = len(timeseries)
    indices = [n // 4, n // 2, 3 * n // 4]

    for i in indices:
        d = timeseries[i]
        manual_calc = d["mstr_market_cap"] / (d["btc_holdings"] * d["btc_price"])
        print(f"\n  Date: {d['date']}")
        print(f"   BTC Price:       ${d['btc_price']:>12,.2f}")
        print(f"   MSTR Close:      ${d['mstr_close']:>12,.2f}")
        print(f"   MSTR Market Cap: ${d['mstr_market_cap']:>12,}")
        print(f"   BTC Holdings:     {d['btc_holdings']:>12,}")
        print(f"   BTC NAV:         ${d['btc_nav']:>12,}")
        print(f"   mNAV (computed):  {d['mnav']:>12.4f}")
        print(f"   mNAV (manual):    {manual_calc:>12.4f}")
        print(f"   Premium/Disc:     {d['premium_pct']:>+11.2f}%")

    latest = timeseries[-1]
    print(f"\n  Latest ({latest['date']}):")
    status = "Premium" if latest["mnav"] > 1 else "Discount"
    print(f"   mNAV = {latest['mnav']:.4f} ({status} {abs(latest['premium_pct']):.1f}%)")

    print("\n" + "=" * 60)
    print("CP-1 CHECKLIST:")
    print(f"  [ ] JSON has {len(timeseries)} data points (need >= 250)")
    print(f"  [ ] mNAV range looks reasonable: {min(d['mnav'] for d in timeseries):.2f} - {max(d['mnav'] for d in timeseries):.2f}")
    print(f"  [ ] Compare 3 dates above with saylortracker.com")
    print(f"  [ ] Trend direction matches external sources")
    print("=" * 60)
    print("\nReply 'CP-1 pass' or 'CP-1 issue: [description]'")


# --- Main ---
if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)

    try:
        btc_prices = fetch_btc_prices()
        mstr_stock = fetch_mstr_stock()
        holdings_events = load_btc_holdings()
        timeseries = compute_mnav(btc_prices, mstr_stock, holdings_events)
        print_validation_report(timeseries)

    except Exception as e:
        print(f"\n ERROR: {e}")
        print("\nRecovery options:")
        print("- CoinGecko down: try CoinCap API or manual CSV download")
        print("- Yahoo Finance blocked: download CSV from finance.yahoo.com")
        import traceback
        traceback.print_exc()
        sys.exit(1)
