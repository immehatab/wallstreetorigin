import type { AssetId, AssetMeta } from "./types";

/**
 * The instrument universe. Order here is the display order.
 * XAUUSD is primary — pinned first and rendered larger in the UI.
 */
export const ASSETS: AssetMeta[] = [
  { id: "XAUUSD", name: "Gold", short: "XAU", class: "metal", decimals: 2, unit: "USD/oz", primary: true },
  { id: "BTCUSD", name: "Bitcoin", short: "BTC", class: "crypto", decimals: 2, unit: "USD" },
  { id: "ETHUSD", name: "Ethereum", short: "ETH", class: "crypto", decimals: 2, unit: "USD" },
  { id: "DXY", name: "US Dollar Index", short: "DXY", class: "fx", decimals: 3, unit: "index" },
  { id: "US10Y", name: "US 10Y Yield", short: "US10Y", class: "rates", decimals: 3, unit: "%" },
  { id: "SP500", name: "S&P 500", short: "SPX", class: "equity_index", decimals: 2, unit: "index" },
  { id: "NASDAQ", name: "Nasdaq Composite", short: "IXIC", class: "equity_index", decimals: 2, unit: "index" },
  { id: "EURUSD", name: "Euro / Dollar", short: "EUR", class: "fx", decimals: 5, unit: "USD" },
  { id: "XAGUSD", name: "Silver", short: "XAG", class: "metal", decimals: 3, unit: "USD/oz" },
  { id: "WTIUSD", name: "WTI Crude Oil", short: "WTI", class: "energy", decimals: 2, unit: "USD/bbl" },
];

export const ASSET_MAP: Record<AssetId, AssetMeta> = Object.fromEntries(
  ASSETS.map((a) => [a.id, a]),
) as Record<AssetId, AssetMeta>;

/**
 * Per-asset-class staleness threshold (ms). Beyond this, a quote is
 * flagged stale in the UI. Futures/FX/index quotes legitimately go
 * stale on weekends & after cash close — the UI says "market closed"
 * rather than crying wolf, but we still surface the age honestly.
 */
export const STALE_THRESHOLD_MS: Record<AssetMeta["class"], number> = {
  crypto: 20_000, // 24/7 markets — should always be fresh
  metal: 120_000, // gold/silver spot trades ~23h/day
  fx: 120_000,
  energy: 300_000,
  equity_index: 300_000,
  rates: 300_000,
};
