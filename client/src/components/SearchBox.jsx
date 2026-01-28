import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchMarkets } from "../api/markets";

function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchBox({ placeholder = "Search markets…" }) {
  const nav = useNavigate();

  const [value, setValue] = useState("");
  const debounced = useDebounced(value, 200);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const rootRef = useRef(null);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(q);
    if (cached) {
      setItems(cached);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);

    searchMarkets(q, { signal: ac.signal, limit: 12 })
      .then((rows) => {
        if (ac.signal.aborted) return;
        cacheRef.current.set(q, rows);
        setItems(rows);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setItems([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [debounced]);

  useEffect(() => {
    function onClick(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(item) {
    setOpen(false);
    setActive(-1);
    setValue("");
    nav(`/markets/${item.slug}`, { state: { question: item.question } });
  }

  function onKeyDown(e) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = value.trim();
      if (!q) return;
      if (active >= 0) pick(items[active]);
      else nav(`/search?q=${encodeURIComponent(q)}`);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const qLenOk = debounced.trim().length >= 2;

  return (
    <div ref={rootRef} className="searchbox">
      <input
        className={`searchbox__input ${open ? "is-open" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open && qLenOk}
      />

      {open && qLenOk && (
        <div className="searchbox__menu" role="listbox">
          {loading && (
            <div className="searchbox__meta">Searching…</div>
          )}

          {!loading && items.length === 0 && (
            <div className="searchbox__meta">No results</div>
          )}

          {!loading &&
            items.map((it, i) => (
              <div
                key={it.slug}
                role="option"
                aria-selected={i === active}
                className={`searchbox__item ${i === active ? "is-active" : ""}`}
                onMouseDown={() => pick(it)}
                onMouseEnter={() => setActive(i)}
              >
                {it.question}
              </div>
            ))}

          {!loading && items.length > 0 && (
            <div
              className="searchbox__footer"
              onMouseDown={() => {
                setOpen(false);
                nav(`/search?q=${encodeURIComponent(debounced.trim())}`);
              }}
            >
              Show all results for <span className="searchbox__q">“{debounced.trim()}”</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
