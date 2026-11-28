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
    <li className="border-t border-rule py-4">
      <div className="flex items-baseline justify-between gap-4">
        <Link href={`/d/${item.id}`} className="font-serif text-entry font-semibold hover:underline">
          {item.title || item.original_url}
        </Link>
        <span className="shrink-0 text-meta text-pencil">
          <LocalDate value={item.saved_at} />
        </span>
      </div>
      <p className="mt-0.5 text-meta text-pencil">{item.domain}</p>
      {item.summary && <p className="mt-2 line-clamp-2 max-w-prose font-serif text-ui text-pencil">{item.summary}</p>}
      {note && <p className="mt-2 text-meta text-pencil">{note}</p>}
    </li>
  );
}
