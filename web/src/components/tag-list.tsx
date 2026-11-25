import Link from "next/link";

/** Tags link to a library search for that tag. */
export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li key={t}>
          <Link
            href={`/?q=${encodeURIComponent(t)}`}
            className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
