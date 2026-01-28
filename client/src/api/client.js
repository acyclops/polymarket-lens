const API_BASE = import.meta.env.VITE_API_BASE_URL; // important

export async function apiGet(path, opts ={}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${text.slice(0,200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0,200)}`);
  }
}
