import { Link } from "react-router-dom";

function fmtNum(x, decimals = 2) {
  if (x === null || x === undefined) return "";
  const n = Number(x);
  if (Number.isNaN(n)) return String(x);

  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: decimals,
    }).format(n);
  }

  return n.toFixed(decimals);
}

function fmtPct(x) {
  if (x == null) return "";
  const n = Number(x);
  if (Number.isNaN(n)) return String(x);

  if (n === 0 || n === 1) return `${(n * 100).toFixed(0)}%`;
  if (n < 0.01) return "<1%";
  if (n > 0.99) return ">99%";

  return `${(n * 100).toFixed(2)}%`;
}

const MODE_META = {
  abs_change: {
    metricLabel: "Max |Δ|",
    metricValue: (r) => fmtPct(r.range),
    showMinMax: true,
  },
  whiplash: {
    metricLabel: "Whiplash",
    metricValue: (r) => r.whiplash,
    showMinMax: false,
  },
  stddev: {
    metricLabel: "Std dev",
    metricValue: (r) => r.stddev,
    showMinMax: false,
  },
  momentum: {
    metricLabel: "Momentum",
    metricValue: (r) => r.momentum_ratio,
    showMinMax: false,
  },
  smart_money: {
    metricLabel: "Smart $",
    metricValue: (r) => r.smart_money_score,
    showMinMax: false,
    extraCols: [
      {
        key: "avg_liquidity",
        label: "Avg liq",
        value: (r) => r.avg_liquidity,
        fmt: (x) => fmtNum(x, 0), // or whatever precision you want
      },
    ],
  },
  chop: {
    metricLabel: "Chop",
    metricValue: (r) => r.chop_index,
    showMinMax: false,
  },
  stability: {
    metricLabel: "Range",
    metricValue: (r) => fmtPct(r.range),
    showMinMax: true,
  },
};

export default function VolatilityTable({ rows, mode = "abs_change", timeWindow }) {
  if (!rows?.length) return null;

  const meta = MODE_META[mode] ?? MODE_META.abs_change;

  return (
    <div className="panel">
      <div className="tableScrollTop">
        <div className="tableScrollInner" />
      </div>
      <div className={`tableWrap ${meta.showMinMax || meta.extraCols ? "table--wide" : ""}`}>
        <table className="table">
          <thead>
            <tr>
              <Th left>Market</Th>

              {meta.showMinMax && (
                <>
                  <Th>Min</Th>
                  <Th>Max</Th>
                </>
              )}

              {meta.extraCols?.map((c) => (
                <Th key={c.key}>{c.label}</Th>
              ))}

              <Th>{meta.metricLabel}</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={r.slug ?? i}>
                <Td left>
                  <Link
                    className="marketLink"
                    to={`/markets/${r.slug}?timeWindow=${encodeURIComponent(timeWindow)}`}
                    state={{ question: r.question }}
                  >
                    {r.question}
                  </Link>
                </Td>

                {meta.showMinMax && (
                  <>
                    <Td>{fmtPct(r.min_p)}</Td>
                    <Td>{fmtPct(r.max_p)}</Td>
                  </>
                )}

                {meta.extraCols?.map((c) => (
                  <Td key={c.key}>{(c.fmt ?? fmt)(c.value(r))}</Td>
                ))}

                <Td>{fmt(meta.metricValue(r))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, left }) {
  return <th className={`th ${left ? "left" : ""}`}>{children}</th>;
}

function Td({ children, left }) {
  return <td className={`td ${left ? "left" : ""}`}>{children}</td>;
}

function fmt(x) {
  if (x === null || x === undefined) return "";
  const n = Number(x);
  if (Number.isNaN(n)) return String(x);
  return n.toFixed(4);
}
