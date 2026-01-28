import { useEffect, useState } from "react";
import VolatilityTable from "../components/VolatilityTable";
import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";
import { getVolatilityLeaderboard } from "../api/markets";

// Per-mode window config
const MODE_META = {
  abs_change: {
    label: "Volatility",
    hint: "Largest probability range",
    defaultWindow: "7 days",
    windows: ["1 day", "7 days", "30 days", "90 days"],
  },
  momentum: {
    label: "Momentum",
    hint: "Markets moving right now",
    defaultWindow: "4 hours",
    windows: ["1 hour", "4 hours"],
  },
  smart_money: {
    label: "Smart Money",
    hint: "Probability shifts supported by capital",
    defaultWindow: "1 day",
    windows: ["1 day", "7 days", "30 days"],
  },
  chop: {
    label: "Chop",
    hint: "Choppy seas",
    defaultWindow: "1 day",
    windows: ["1 day", "7 days"],
  },
  stability: {
    label: "Stability",
    hint: "Stable markets",
    defaultWindow: "7 days",
    windows: ["1 day", "7 days", "30 days"],
  },
};

// Button order
const MODES = [
  "abs_change",
  "momentum",
  "smart_money",
  "chop",
  "stability",
];

export default function Volatility() {
  const [mode, setMode] = useState("abs_change");
  const [timeWindow, setTimeWindow] = useState(MODE_META["abs_change"].defaultWindow);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const modeHint = MODE_META[mode]?.hint ?? "";
  const windowsForMode = MODE_META[mode]?.windows ?? ["7 days"];

  useEffect(() => {
    const { defaultWindow, windows } = MODE_META[mode] ?? {};
    if (!windows?.includes(timeWindow)) {
      setTimeWindow(defaultWindow ?? "7 days");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getVolatilityLeaderboard(timeWindow, mode)
      .then((data) => {
        if (alive) setRows(data.rows);
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [timeWindow, mode]);

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="pageTitle">Leaderboards</h1>

        <div className="controlsRow">
          <div className="tabs" role="tablist" aria-label="Leaderboard mode">
            {MODES.map((key) => {
              const m = MODE_META[key];
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`tab ${active ? "active" : ""}`}
                  role="tab"
                  aria-selected={active}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="hint">{modeHint}</div>
        </div>
        <div className="windowRow">
          <div className="windowSelect">
            <span className="windowLabel">Window</span>
            <select
              className="select"
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
            >
              {windowsForMode.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      <ErrorBox error={error} />
      {!loading && !error && (
        <VolatilityTable rows={rows} mode={mode} timeWindow={timeWindow} />
      )}
    </div>
  );
}