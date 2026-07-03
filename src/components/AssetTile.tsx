import type { AssetSnapshot } from "@/core/types";
import { formatAge, formatChange, formatPrice } from "@/lib/format";

const CLASS_LABEL: Record<string, string> = {
  metal: "Metal",
  crypto: "Crypto",
  equity_index: "Index",
  fx: "FX",
  rates: "Rates",
  energy: "Energy",
};

export function AssetTile({ snap, now }: { snap: AssetSnapshot; now: number }) {
  const { meta, quote, stale } = snap;
  const primary = meta.primary ? "primary" : "";

  if (!quote) {
    return (
      <div className={`tile nodata ${primary}`}>
        <div className="head">
          <div>
            <div className="sym">{meta.id}</div>
            <div className="name">{meta.name}</div>
          </div>
          <span className="cls">{CLASS_LABEL[meta.class]}</span>
        </div>
        <div className="price dim mono">NO DATA</div>
        <div className="foot">
          <span>awaiting first tick</span>
          <span className="src-badge">—</span>
        </div>
      </div>
    );
  }

  const chg = formatChange(quote.changePct);
  const ageMs = now - quote.ts;

  return (
    <div className={`tile ${primary} ${stale ? "stale" : ""}`}>
      <div className="head">
        <div>
          <div className="sym">{meta.id}</div>
          <div className="name">{meta.name}</div>
        </div>
        <span className="cls">{CLASS_LABEL[meta.class]}</span>
      </div>

      <div className="price mono">
        {formatPrice(quote.price, meta.decimals)}
        {meta.unit === "%" ? <span style={{ fontSize: "0.5em", color: "var(--muted)" }}> %</span> : null}
      </div>

      <div className="row2">
        <span className={`chg mono ${chg.cls}`}>{chg.text}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
          {meta.unit}
        </span>
      </div>

      <div className="foot">
        <span className="mono">upd {formatAge(ageMs)} ago</span>
        <span className="src-badge mono">{quote.source}</span>
      </div>
    </div>
  );
}
