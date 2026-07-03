# XAU·TERMINAL — AI-Powered Institutional Trading Terminal

A personal, institutional-grade trading terminal focused on **XAUUSD**, built one
production-ready module at a time.

**Core rule:** every value is traceable to a named, timestamped source — or it is shown
as `NO DATA`. Nothing is guessed or hallucinated.

---

## Status

| Module | Scope | State |
|---|---|---|
| **1 — Data Foundation** | Keyless ingestion (10 assets), normalization, SQLite store, live health dashboard | ✅ **shipped** |
| **2 — News + Macro Engine** | Keyless FRED macro (gold-bias engine) + RSS news with transparent impact scoring | ✅ **shipped** |
| 3 — XAUUSD SMC/ICT Engine | BOS/CHOCH/FVG/OB, premium-discount, sessions (Python quant service) | ⏳ next |
| 4 — AI Decision Layer | Macro/News/Liquidity/Quant/Risk agents debate → consensus bias | ⏳ |
| 5 — BTC On-chain Engine | Funding, OI, liquidation maps, exchange flows | ⏳ |

## Module 2 — what runs today (keyless)

- **Macro engine (FRED CSV, no key):** 8 curated series that move gold — 10Y **real yield** (the #1 driver), broad USD, fed funds, breakeven & CPI inflation, 10Y nominal, Fed balance sheet, VIX. Each carries a rule-based gold interpretation; they aggregate into one **transparent weighted gold macro bias** (score −100…+100 + confidence). Hover a row for the transmission mechanism.
- **News engine (RSS, no key):** Fed · ECB · MarketWatch · FXStreet · Cointelegraph. Every headline is scored by a **transparent heuristic engine** — importance, market impact, probability, confidence, affected assets, and a short/medium gold lean, with the exact matched rules exposed for audit. It is keyword-based (negation-blind); set `ANTHROPIC_API_KEY` to upgrade to LLM scoring.
- **Upgrades:** add `FINNHUB_API_KEY` for the economic calendar + richer feeds; the source registry lights it up automatically.

## Module 1 — what runs today

Ten assets, all on **verified keyless feeds** (no signup required):

- **XAUUSD** — gold-api.com spot (primary) · Yahoo `GC=F` futures (fallback)
- **BTCUSD / ETHUSD** — Binance public
- **SP500 / NASDAQ / DXY / US10Y / Silver / Oil / EURUSD** — Yahoo Finance public

Each source is polled on its own cadence, health-tracked (latency, failures, staleness),
and written to a local SQLite tick log. The dashboard polls a snapshot every 2s and shows
a data-integrity score.

## Run it

```bash
cd trading-terminal
npm install
npm run probe      # optional: hit every feed once, print live quotes
npm run dev        # http://localhost:3000
```

Requires Node 20+ (built on Node 24). SQLite file lands in `data/terminal.db`.

## Architecture

```
instrumentation.ts ── boots ── scheduler ── adapters (binance/goldapi/yahoo)
                                    │
                                    ▼
                              SQLite store  ──►  /api/snapshot  ──►  dashboard
   src/core/registry.ts = single source of truth for every provider
```

## Adding data sources

Everything flows from `src/core/registry.ts`. Keyed sources (Finnhub, FRED, Twelve Data,
Coinglass…) are already declared there and appear greyed in the health panel until you add
the matching key to `.env` — then they activate. See `.env.example`.
