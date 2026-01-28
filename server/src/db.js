import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in environment");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function query(sql, params) {
  const start = Date.now();
  try {
    const res = await pool.query(sql, params);
    const ms = start - Date.now();
    return { rows: res.rows, rowCount: res.rowCount, ms };
  } catch (err) {
    err.query = sql;
    throw err;
  }
}
