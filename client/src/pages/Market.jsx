import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import TimeseriesChart from "../components/TimeseriesChart";
import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";
import { getMarketTimeseries } from "../api/markets";

const WINDOWS = ["1 hour", "4 hours", "1 day", "7 days", "30 days"];

export default function Market() {
  const { slug } = useParams();
  const location = useLocation();
  const question = location.state?.question;

  const [searchParams, setSearchParams] = useSearchParams();
  const timeWindow = searchParams.get("timeWindow") ?? "7 days";

  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function onWindowChange(newWindow) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("timeWindow", newWindow);
        return next;
      },
      {
        replace: true,
        state: location.state,
      }
    );
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getMarketTimeseries(slug, timeWindow)
      .then((rows) => {
        if (alive) setPoints(rows);
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
  }, [slug, timeWindow]);

  return (
    <div className="page">
      <div className="marketHeader">
        <div>
          <h1 className="marketTitle">{question ?? slug}</h1>
        </div>

        <div className="windowSelect">
          <span className="windowLabel">Window</span>
          <select
            className="select"
            value={timeWindow}
            onChange={(e) => onWindowChange(e.target.value)}
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <Loading />}
      <ErrorBox error={error} />

      {!loading && !error && (
        <div className="panel chartPanel">
          <TimeseriesChart points={points} />
        </div>
      )}
    </div>
  );
}
