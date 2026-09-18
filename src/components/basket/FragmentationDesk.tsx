import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Layers, ShieldAlert } from "lucide-react";
import { axisApi, type InstrumentTruth } from "../../lib/api";

const DEFAULT_SYMBOLS = ["TSLA", "AMZN", "AMD", "NFLX", "PLTR"];

function claimLabel(claim: string) {
  switch (claim) {
    case "broker_stock_token":
      return "Broker stock token";
    case "linked_tracker":
      return "Linked tracker";
    case "derivative_note":
      return "Derivative note";
    case "direct_register":
      return "Direct register";
    default:
      return claim;
  }
}

function InstrumentRow({ row }: { row: InstrumentTruth }) {
  return (
    <li className="border border-white/10 rounded-2xl px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm tracking-[-0.03em]">
            {row.display_symbol}
            <span className="text-white/40"> · {row.issuer}</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/40 pt-1">
            {claimLabel(row.claim_type)} · {row.chain}
            {row.testnet ? " · testnet" : ""}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          {row.axis_routeable ? (
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-lime)]">
              AXIS route
            </div>
          ) : (
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Compare only
            </div>
          )}
          {!row.address_verified && (
            <div className="text-[10px] text-amber-300/90">Unverified addr</div>
          )}
        </div>
      </div>
      <p className="text-xs text-white/55 leading-relaxed">{row.claim_summary}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45">
        <span>mint/redeem: {row.mint_redeem}</span>
        <span>share cert: {row.is_share ? "yes" : "no"}</span>
        {row.geo?.us_persons && <span>US: {row.geo.us_persons}</span>}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {row.explorer_url && (
          <a
            href={row.explorer_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white underline"
          >
            Explorer <ExternalLink size={11} />
          </a>
        )}
        {row.docs_url && (
          <a
            href={row.docs_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white/60 underline"
          >
            Issuer docs <ExternalLink size={11} />
          </a>
        )}
      </div>
    </li>
  );
}

export function FragmentationDesk({ symbols }: { symbols?: string[] }) {
  const choices = symbols?.length ? symbols : DEFAULT_SYMBOLS;
  const [symbol, setSymbol] = useState(choices[0] ?? "TSLA");

  const desk = useQuery({
    queryKey: ["axis", "frag-desk"],
    queryFn: () => axisApi.basket.fragmentationDesk(),
  });

  const compare = useQuery({
    queryKey: ["axis", "frag", symbol],
    queryFn: () => axisApi.basket.fragmentation(symbol),
    enabled: Boolean(symbol),
  });

  const data = compare.data;

  return (
    <div className="border border-white/10 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Layers size={18} className="mt-0.5 text-[color:var(--color-lime)] shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">
            Fragmentation desk
          </div>
          <h3 className="text-lg tracking-[-0.03em]">Same company · not the same instrument</h3>
          <p className="text-sm text-white/55 pt-1 leading-relaxed">
            {desk.data?.honesty ??
              "Compare RH / Ondo / xStocks without pretending they are fungible."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(desk.data?.underlyings.map((u) => u.symbol) ?? choices).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            className={`text-[10px] uppercase tracking-widest border px-3 py-1.5 rounded-full ${
              symbol === s
                ? "border-[color:var(--color-lime)] text-[color:var(--color-lime)]"
                : "border-white/20 hover:bg-white/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {compare.isLoading && <p className="text-sm text-white/40">Loading truth…</p>}
      {compare.isError && (
        <p className="text-sm text-red-300">Could not load fragmentation compare.</p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-3 text-[11px] text-white/50">
            <span className="text-white/80">
              {typeof data.company?.name === "string" ? data.company.name : symbol}
            </span>
            <span>fungible: {String(data.fungible)}</span>
            <span>AXIS: {data.axis_action}</span>
            <span>
              {data.instruments.length} instruments ·{" "}
              {(data.verified_instruments ?? []).length} verified
            </span>
          </div>

          {data.warnings?.length > 0 && (
            <ul className="space-y-2">
              {data.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 text-xs text-amber-200/90 leading-relaxed"
                >
                  <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <ul className="space-y-3">
            {data.instruments.map((row) => (
              <InstrumentRow key={row.instrument_id} row={row} />
            ))}
          </ul>

          <p className="text-[11px] text-white/40 leading-relaxed">{data.honesty}</p>
        </>
      )}
    </div>
  );
}
