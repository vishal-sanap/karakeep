"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions";
import { ThemeSwitch } from "./theme-toggle";

/** Pages with their own search (library bar, tiles overlay) listen for this. */
export const SEARCH_EVENT = "unfold:search";
declare global {
  interface Window {
    __unfoldSearchHandlers?: number;
  }
}
export function useSearchHandler(open: () => void) {
  useEffect(() => {
    window.__unfoldSearchHandlers = (window.__unfoldSearchHandlers ?? 0) + 1;
    window.addEventListener(SEARCH_EVENT, open);
    return () => {
      window.__unfoldSearchHandlers = (window.__unfoldSearchHandlers ?? 1) - 1;
      window.removeEventListener(SEARCH_EVENT, open);
    };
  }, [open]);
}

/** Search icon in the nav: opens this page's search, or the library's. */
export function SearchButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.__unfoldSearchHandlers) window.dispatchEvent(new Event(SEARCH_EVENT));
        else router.push("/?search=1");
      }}
      aria-label="Search your library"
      title="Search"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-pencil hover:bg-ink/5 hover:text-ink"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}

/** Account icon (your initial) with Profile, Settings, dark mode and sign out. */
export function AccountMenu({ email }: { email: string }) {
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

  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const item = "block rounded-lg px-3 py-2 text-ui hover:bg-ink/5";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="grid h-8 w-8 place-items-center rounded-full bg-ink font-serif text-ui font-semibold text-paper hover:opacity-90"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-rule bg-sheet p-1.5 text-ink shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]">
          <p className="truncate px-3 pb-2 pt-2 text-meta text-pencil">Signed in as {email}</p>
          <div className="my-1 h-px bg-rule" />
          <Link href="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link href="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Settings
          </Link>
          <ThemeSwitch />
          <div className="my-1 h-px bg-rule" />
          <form action={signOutAction}>
            <button role="menuitem" className={`${item} w-full text-left text-pencil hover:text-ink`}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
