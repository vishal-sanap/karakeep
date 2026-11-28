"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchHandler } from "./header-actions";

/**
 * Search stays out of the way: a search icon (or Ctrl/Cmd+F) opens the bar,
 * Enter searches, Esc closes it and clears the results.
 */
export function LibrarySearch({ q, autoOpen = false }: { q?: string; autoOpen?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(Boolean(q) || autoOpen);
  const [value, setValue] = useState(q ?? "");
  const [mod, setMod] = useState("Ctrl");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌘");
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.select());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setValue(q ?? ""), [q]);

  // The nav's search icon opens this bar.
  const openFromNav = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);
  useSearchHandler(openFromNav);

  const close = () => {
    setOpen(false);
    setValue("");
    if (q) router.push("/");
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="pill" aria-label="Search your library">
        <SearchIcon />
        <span>Search</span>
        <kbd className="hidden font-sans text-meta text-pencil sm:inline">{mod} F</kbd>
      </button>
    );

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = value.trim();
        router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
      }}
      className="flex min-w-0 basis-full items-center gap-2 rounded-2xl border border-pen bg-sheet px-4"
    >
      <SearchIcon />
      <label htmlFor="library-search" className="sr-only">
        Search your library
      </label>
      <input
        ref={inputRef}
        id="library-search"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
        placeholder="Search by what you remember about it"
        className="min-w-0 flex-1 bg-transparent py-3 text-ui text-ink outline-none placeholder:text-pencil"
      />
      <button type="button" onClick={close} className="action shrink-0">
        {q ? "Clear" : "Close"}
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-pencil" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
