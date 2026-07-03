/**
 * Standalone feed probe — `npm run probe`.
 * Hits every keyless adapter once and prints normalized quotes so you
 * can confirm live data without booting the UI or touching the DB.
 */
import { binanceAdapter } from "./adapters/binance";
import { goldApiAdapter } from "./adapters/goldapi";
import { yahooAdapter } from "./adapters/yahoo";
import type { Adapter } from "./adapter";

const adapters: Adapter[] = [goldApiAdapter, binanceAdapter, yahooAdapter];

async function main() {
  const now = Date.now();
  for (const a of adapters) {
    process.stdout.write(`\n── ${a.id} ─────────────────────────────\n`);
    try {
      const quotes = await a.poll();
      for (const q of quotes) {
        const age = ((now - q.ts) / 1000).toFixed(0);
        const chg = q.changePct == null ? "  —  " : `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`;
        console.log(
          `${q.asset.padEnd(7)} ${String(q.price).padStart(12)} ${chg.padStart(8)}  ${q.sourceSymbol.padEnd(9)} age:${age}s`,
        );
      }
      console.log(`  ✓ ${quotes.length} quote(s)`);
    } catch (e) {
      console.log(`  ✗ FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().then(() => process.exit(0));
