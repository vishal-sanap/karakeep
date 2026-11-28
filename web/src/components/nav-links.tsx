"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Library", match: (p: string) => p === "/" || p.startsWith("/d/") },
  { href: "/tiles", label: "Tiles", match: (p: string) => p.startsWith("/tiles") },
  { href: "/explore", label: "Explore", match: (p: string) => p.startsWith("/explore") || p.startsWith("/threads") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings"), icon: true },
];

/** Main navigation as pills inside the glass bar; the current page is filled. On phones Settings is a gear. */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="ml-auto flex min-w-0 items-center gap-0.5 text-meta sm:text-ui">
      {LINKS.map((l) => {
        const current = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            aria-label={l.icon ? l.label : undefined}
            className={`shrink-0 rounded-full px-2.5 py-1 sm:px-3 ${current ? "bg-ink text-paper" : "text-pencil hover:bg-ink/5 hover:text-ink"}`}
          >
            {l.icon ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="sm:hidden" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
                <span className="hidden sm:inline">{l.label}</span>
              </>
            ) : (
              l.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
