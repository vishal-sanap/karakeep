import Link from "next/link";
import { LocalDate } from "./local-date";

type Item = {
  id: string;
  title: string | null;
  original_url: string;
  domain: string | null;
  favicon_url: string | null;
  summary?: string | null;
  saved_at: Date | string;
};

/** Compact list row: title opens the detail page, with an optional context note. */
export function ItemRow({ item, note }: { item: Item; note?: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex gap-2">
        {item.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.favicon_url} alt="" width={16} height={16} className="mt-0.5 h-4 w-4 shrink-0 rounded-sm" referrerPolicy="no-referrer" />
        ) : (
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-sm bg-stone-200 dark:bg-stone-700" />
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/d/${item.id}`} className="text-sm font-medium hover:underline">
            {item.title || item.original_url}
          </Link>
          <div className="text-xs text-stone-500">
            {item.domain} · saved <LocalDate value={item.saved_at} />
          </div>
          {item.summary && <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{item.summary}</p>}
          {note && <p className="mt-1 text-xs text-stone-500">{note}</p>}
        </div>
      </div>
    </li>
  );
}
