import { extractUrl } from "@/lib/url";
import { ShareForm } from "@/components/share-form";

export const dynamic = "force-dynamic";

/**
 * PWA share target (see app/manifest.ts). Android usually puts the link in
 * `text`, sometimes in `url`; title may also hold it.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}) {
  const { url, text, title } = await searchParams;
  const found = extractUrl(url, text, title);

  return (
    <div className="mx-auto mt-8 max-w-md space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Save to unfold</h1>
      {title && <p className="text-sm text-stone-500">{title}</p>}
      <ShareForm url={found ?? ""} />
    </div>
  );
}
