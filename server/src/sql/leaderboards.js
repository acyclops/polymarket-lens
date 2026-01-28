export const SQL_ABS_RANGE = `
  SELECT
    m.market_id,
    m.question,
    m.slug,
    MIN(t.probability) AS min_p,
    MAX(t.probability) AS max_p,
    (MAX(t.probability) - MIN(t.probability)) AS range,
    NULL::double precision AS whiplash,
    NULL::double precision AS avg_step,
    NULL::int AS n_points,
    NULL::double precision AS stddev
  FROM market_ticks t
  JOIN markets m ON m.market_id = t.market_id
  WHERE t.ts >= now() - ($1::interval)
    AND t.probability IS NOT NULL
  GROUP BY m.market_id, m.question, m.slug
  ORDER BY range DESC
  LIMIT 50;
`;

export const SQL_VOLATILITY_WHIPLASH = `
  WITH series AS (
    SELECT
      t.market_id,
      m.question,
      m.slug,
      t.ts,
      t.probability,
      LAG(t.probability) OVER (PARTITION BY t.market_id ORDER BY t.ts) AS prev_p
    FROM market_ticks t
    JOIN markets m ON m.market_id = t.market_id
    WHERE t.ts >= now() - ($1::interval)
      AND t.probability IS NOT NULL
  )
  SELECT
    market_id,
    question,
    slug,
    NULL::double precision AS min_p,
    NULL::double precision AS max_p,
    NULL::double precision AS range,
    SUM(ABS(probability - prev_p)) AS whiplash,
    AVG(ABS(probability - prev_p)) AS avg_step,
    COUNT(*) AS n_points,
    NULL::double precision AS stddev
  FROM series
  WHERE prev_p IS NOT NULL
  GROUP BY market_id, question, slug
  ORDER BY whiplash DESC
  LIMIT 50;
`;

export const SQL_VOLATILITY_STDDEV = `
  WITH series AS (
    SELECT
      t.market_id,
      m.question,
      m.slug,
      t.ts,
      t.probability,
      LAG(t.probability) OVER (PARTITION BY t.market_id ORDER BY t.ts) AS prev_p
    FROM market_ticks t
    JOIN markets m ON m.market_id = t.market_id
    WHERE t.ts >= now() - ($1::interval)
      AND t.probability IS NOT NULL
  ),
  steps AS (
    SELECT
      market_id,
      question,
      slug,
      (probability - prev_p) AS step
    FROM series
    WHERE prev_p IS NOT NULL
  )
  SELECT
    market_id,
    question,
    slug,
    NULL::double precision AS min_p,
    NULL::double precision AS max_p,
    NULL::double precision AS range,
    NULL::double precision AS whiplash,
    NULL::double precision AS avg_step,
    COUNT(*) AS n_points,
    STDDEV_SAMP(step) AS stddev
  FROM steps
  GROUP BY market_id, question, slug
  ORDER BY stddev DESC NULLS LAST
  LIMIT 50;
`;

export const SQL_VOLATILITY_MOMENTUM = `
  WITH recent AS (
    SELECT
        market_id,
        STDDEV_SAMP(probability) AS std_1h
    FROM market_ticks
    WHERE ts >= now() - interval '1 hour'
        AND probability IS NOT NULL
    GROUP BY market_id
    ),
  baseline AS (
    SELECT
        market_id,
        STDDEV_SAMP(probability) AS std_window
    FROM market_ticks
    WHERE ts >= now() - ($1::interval)
        AND probability IS NOT NULL
    GROUP BY market_id
    )
  SELECT
    m.market_id,
    m.question,
    m.slug,
    r.std_1h,
    b.std_window,
    (r.std_1h / NULLIF(b.std_window, 0)) AS momentum_ratio
  FROM recent r
  JOIN baseline b USING (market_id)
  JOIN markets m USING (market_id)
  ORDER BY momentum_ratio DESC NULLS LAST
  LIMIT 50;
`;

export const SQL_VOLATILITY_SMART_MONEY = `
  WITH series AS (
    SELECT
        t.market_id,
        t.ts,
        t.probability,
        t.liquidity,
        LAG(t.probability) OVER (PARTITION BY t.market_id ORDER BY t.ts) AS prev_p
    FROM market_ticks t
    WHERE t.ts >= now() - ($1::interval)
        AND t.probability IS NOT NULL
    ),
  scored AS (
    SELECT
        market_id,
        MAX(ABS(probability - prev_p)) AS max_step,
        AVG(liquidity) AS avg_liquidity
    FROM series
    WHERE prev_p IS NOT NULL
    GROUP BY market_id
    )
  SELECT
    m.market_id,
    m.question,
    m.slug,
    s.max_step,
    s.avg_liquidity,
    (s.max_step * LN(s.avg_liquidity + 1)) AS smart_money_score
  FROM scored s
  JOIN markets m USING (market_id)
  ORDER BY smart_money_score DESC
  LIMIT 50;
`;

export const SQL_VOLATILITY_CHOP = `
  WITH steps AS (
    SELECT
        market_id,
        ABS(probability - LAG(probability)
        OVER (PARTITION BY market_id ORDER BY ts)) AS step
    FROM market_ticks
    WHERE ts >= now() - ($1::interval)
        AND probability IS NOT NULL
    )
  SELECT
    m.market_id,
    m.question,
    m.slug,
  COUNT(*) FILTER (WHERE step IS NOT NULL) AS n_points,
  AVG(step) AS chop_index,
  SUM(step) AS total_chop
  FROM steps s
  JOIN markets m USING (market_id)
  WHERE step IS NOT NULL
  GROUP BY m.market_id, m.question, m.slug
  ORDER BY chop_index DESC
  LIMIT 50;
`;

export const SQL_VOLATILITY_STABILITY = `
  WITH stats AS (
    SELECT
        market_id,
        MIN(probability) AS min_p,
        MAX(probability) AS max_p,
        COUNT(*) AS n_points
    FROM market_ticks
    WHERE ts >= now() - ($1::interval)
        AND probability IS NOT NULL
    GROUP BY market_id
    )
  SELECT
    m.market_id,
    m.question,
    m.slug,
    s.min_p,
    s.max_p,
    (s.max_p - s.min_p) AS range,
    s.n_points
  FROM stats s
  JOIN markets m USING (market_id)
  WHERE s.n_points >= 10
  ORDER BY range ASC
  LIMIT 50;
`;
