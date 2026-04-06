export interface DataPoint {
  date: string
  mnav: number
  premium_pct: number
  btc_price: number
  mstr_close: number
  mstr_market_cap: number
  btc_holdings: number
  btc_nav: number
}

export interface MnavData {
  metadata: {
    indicator: string
    formula: string
    company: string
    data_sources: Record<string, string>
    generated_at: string
    total_data_points: number
  }
  data: DataPoint[]
}
