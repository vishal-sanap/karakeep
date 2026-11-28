"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Site footer: the useful secondary destinations, plus keyboard shortcuts. Hidden on the full-screen tiles. */
export function SiteFooter() {
  const path = usePathname();
  if (path.startsWith("/tiles") || path.startsWith("/login")) return null;
  return (
    <footer className="container-page pb-10">
      <div className="flex flex-col gap-4 border-t border-rule pt-6 text-meta text-pencil sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xs">
          <span className="font-serif text-ui font-semibold text-ink">unfold</span> keeps what you find and why. Pages are
          read on this server; nothing is sent to an AI service.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/?import=1" className="hover:text-ink hover:underline">
            Import links
          </Link>
          <Link href="/settings#data" className="hover:text-ink hover:underline">
            Export your data
          </Link>
          <Link href="/settings#extension" className="hover:text-ink hover:underline">
            Chrome extension
          </Link>
          <Shortcuts />
          <Link href="/settings" className="hover:text-ink hover:underline">
            Settings
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function Shortcuts() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="hover:text-ink hover:underline">
        Keyboard shortcuts
      </button>
      {open && (
        <div role="dialog" aria-label="Keyboard shortcuts" className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-rule bg-sheet p-4 text-ui text-ink shadow-lg">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-pencil">{mod} F</dt>
            <dd>Search your library</dd>
            <dt className="text-pencil">{mod} V</dt>
            <dd>Paste a link to save it</dd>
            <dt className="text-pencil">Esc</dt>
            <dd>Close search or a dialog</dd>
            <dt className="text-pencil">Arrows</dt>
            <dd>Move around the tiles</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
