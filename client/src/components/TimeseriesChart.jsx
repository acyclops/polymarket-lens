import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function fmtLocal(iso, opts = {}) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  });
}

function fmtPct(v, decimals = 2) {
  if (v == null) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);

  if (n === 0 || n === 1) return `${(n * 100).toFixed(0)}%`;
  if (n < 0.01) return "<1%";
  if (n > 0.99) return ">99%";

  return `${(n * 100).toFixed(decimals)}%`;
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function TimeseriesChart({ points }) {
  if (!points?.length) return <div style={{ marginTop: 12 }}>No data.</div>;

  const data = points.map((p) => ({
    ts: p.ts,
    label: fmtLocal(p.ts, { hour12: false }),
    probability: p.probability == null ? null : Number(p.probability),
    volume24hr: p.volume24hr == null ? null : Number(p.volume24hr),
    liquidity: p.liquidity == null ? null : Number(p.liquidity),
  }));

  return (
    <>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Probability</div>

      <div className="chartMeta">
        Times shown in {tz}
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 6, left: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />

            <XAxis
              dataKey="label"
              minTickGap={30}
              tick={{ fill: "rgba(255,255,255,0.65)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />

            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => fmtPct(v, 0)}
              tick={{ fill: "rgba(255,255,255,0.65)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
              width={48}
            />

            <Tooltip
              formatter={(v, name) => [fmtPct(v, 2), name]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.ts
                  ? fmtLocal(payload[0].payload.ts, { second: "2-digit" })
                  : ""
              }
              contentStyle={{
                background: "rgba(10,12,18,0.92)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}
              itemStyle={{ color: "rgba(255,255,255,0.95)", fontWeight: 650 }}
            />

            <Line
              type="monotone"
              dataKey="probability"
              dot={false}
              isAnimationActive={false}
              strokeWidth={2.2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
