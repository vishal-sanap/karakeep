"use client";
import { useEffect, useRef, useState } from "react";

type Result = { id: string; title: string | null; domain: string | null; summary: string | null; favicon_url: string | null };

/**
 * Search over the tiles: a blurred overlay with a search box. Picking a
 * result hands its id back so the grid can fly to that tile.
 */
export function SearchOverlay({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced search; stale responses are ignored.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setDegraded(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/discoveries?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { items: Result[]; degraded?: boolean };
        setResults(body.items.slice(0, 8));
        setDegraded(Boolean(body.degraded));
        setSelected(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const pick = (r: Result | undefined) => r && onPick(r.id);

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-[#14171b]/55 px-4 pt-[12vh] backdrop-blur-md"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Search your library"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-[#e4e7ea]/10 bg-[#1b1f24] text-[#e4e7ea]">
        <div className="flex items-center gap-3 border-b border-[#e4e7ea]/10 px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[#9ba2a9]" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(results[selected]);
              }
            }}
            placeholder="Search by what you remember about it"
            aria-label="Search your library"
            className="w-full bg-transparent py-4 text-entry outline-none placeholder:text-[#9ba2a9]"
            aria-controls="tile-search-results"
            aria-activedescendant={results[selected] ? `tile-result-${results[selected].id}` : undefined}
          />
          <kbd className="hidden shrink-0 font-sans text-meta text-[#9ba2a9] sm:block">Esc</kbd>
        </div>

        {q.trim() && (
          <ul id="tile-search-results" role="listbox" className="max-h-[50vh] overflow-auto py-1">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`tile-result-${r.id}`}
                role="option"
                aria-selected={i === selected}
                onMouseEnter={() => setSelected(i)}
                onClick={() => pick(r)}
                className={`flex cursor-pointer gap-3 px-4 py-2.5 ${i === selected ? "bg-[#e4e7ea]/10" : ""}`}
              >
                {r.favicon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.favicon_url} alt="" width={16} height={16} className="mt-0.5 h-4 w-4 shrink-0 rounded-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="mt-0.5 h-4 w-4 shrink-0 rounded-sm bg-[#e4e7ea]/10" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-serif text-ui font-semibold">{r.title ?? r.domain}</div>
                  <div className="truncate text-meta text-[#9ba2a9]">{r.domain}</div>
                  {r.summary && <div className="truncate text-meta text-[#9ba2a9]">{r.summary}</div>}
                </div>
              </li>
            ))}
            {!loading && results.length === 0 && <li className="px-4 py-3 text-ui text-[#9ba2a9]">Nothing matched. Try describing it differently.</li>}
            {degraded && <li className="px-4 py-2 text-meta text-[#9ba2a9]">Showing exact word matches only; the similarity search failed.</li>}
          </ul>
        )}
        <p className="border-t border-[#e4e7ea]/10 px-4 py-2 text-meta text-[#9ba2a9]">Use the arrow keys to choose, Enter to go to the tile, Esc to close.</p>
      </div>
    </div>
  );
}
