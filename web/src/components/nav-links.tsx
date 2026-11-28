"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Library", match: (p: string) => p === "/" || p.startsWith("/d/") },
  { href: "/tiles", label: "Tiles", match: (p: string) => p.startsWith("/tiles") },
  { href: "/explore", label: "Explore", match: (p: string) => p.startsWith("/explore") || p.startsWith("/threads") },
];

/** Main navigation as pills inside the glass bar; the current page is filled. */
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
            className={`shrink-0 rounded-full px-2.5 py-1 sm:px-3 ${current ? "bg-ink text-paper" : "text-pencil hover:bg-ink/5 hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
