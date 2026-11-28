import Link from "next/link";

/** Tags as chips; each searches the library for that tag. */
export function TagList({ tags, className = "", max }: { tags: string[]; className?: string; max?: number }) {
  if (!tags.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Tags">
      {shown.map((t) => (
        <li key={t}>
          <Link href={`/?q=${encodeURIComponent(t)}`} className="chip">
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
