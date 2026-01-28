// pages/Search.jsx
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { searchMarkets } from "../api/markets";
import MarketList from "../components/MarketList";
import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!q) {
      setMarkets([]);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    searchMarkets(q, { limit: 200 })
      .then((rows) => {
        if (alive) setMarkets(rows);
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
  }, [q]);

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>
        Search results for <span style={{ opacity: 0.7 }}>"{q}"</span>
      </h2>

      {loading && <Loading />}
      <ErrorBox error={error} />

      {!loading && !error && <MarketList markets={markets} />}
    </div>
  );
}
