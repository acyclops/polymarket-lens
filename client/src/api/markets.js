import { apiGet } from "./client";

// /api/markets/search?q=
export function searchMarkets(q, { signal, limit } = {}) {
  const qs = new URLSearchParams({ q });
  if (limit) qs.set("limit", String(limit));

  return apiGet(`/markets/search?${qs.toString()}`, { signal });
}

// /api/markets/:slug/timeseries?window=
export function getMarketTimeseries(slug, window = "7 days") {
  return apiGet(
    `/markets/${slug}/timeseries?window=${encodeURIComponent(window)}`
  );
}

// /api/leaderboards/volatility?window=
export function getVolatilityLeaderboard(window = "7 days", mode = "whiplash") {
  return apiGet(
    `/leaderboards/${mode}?window=${encodeURIComponent(window)}`
  );
}

// /internal/market-ticks/:marketId
export function getMarketTicks(marketId, limit = 200) {
  return apiGet(
    `/internal/market-ticks/${marketId}?limit=${limit}`
  );
}

export function getStatusInfo() {
  return apiGet("/status");
}
