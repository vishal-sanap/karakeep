"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/tiles", label: "Tiles" },
  { href: "/threads", label: "Threads" },
  { href: "/rediscover", label: "Rediscover" },
  { href: "/settings", label: "Settings" },
];

/** Site navigation; the current page is marked in ink with an underline. */
export function NavLinks() {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" || path.startsWith("/d/") : path.startsWith(href));
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-ui">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={current(l.href) ? "page" : undefined}
          className={
            current(l.href)
              ? "text-ink underline decoration-pen decoration-2 underline-offset-[6px]"
              : "text-pencil hover:text-ink"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
