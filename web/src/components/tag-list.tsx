import Link from "next/link";

/** Tags as plain words; each searches the library for that tag. */
export function TagList({ tags, className = "" }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-meta ${className}`} aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          <Link href={`/?q=${encodeURIComponent(t)}`} className="text-pencil underline-offset-2 hover:text-ink hover:underline">
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
