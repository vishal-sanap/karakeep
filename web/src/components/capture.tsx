"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { importLinksAction, saveAction, updateWhyAction, type ImportResult } from "@/app/actions";
import { parseLinks, type ImportEntry } from "@/lib/bulk";
import { BulkImport } from "./bulk-import";

/** "example.com/x" -> "https://example.com/x"; null if it can't be a link. */
function toUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : /^[^/]+\.[a-z]{2,}(\/|$)/i.test(s) ? `https://${s}` : s;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const BAD_LINK = "That isn't a link. Paste a web address, like https://example.com/article.";

/**
 * The capture box. Paste a link and it saves at once (no button); then an
 * optional "why" line appears for it. Paste several links and it offers to
 * import them all. A file dropped here opens the importer.
 */
export function Capture({ toolbar, autoImport = false }: { toolbar?: React.ReactNode; autoImport?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; host: string } | null>(null);
  const [why, setWhy] = useState("");
  const [noteDone, setNoteDone] = useState(false);
  const [multi, setMulti] = useState<ImportEntry[] | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  // Inline import panel (opens under the row, like search). `file`: dropped on the box.
  const [importer, setImporter] = useState<{ file?: File | null } | null>(autoImport ? {} : null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();

  const save = (raw: string) => {
    const url = toUrl(raw);
    if (!url) return setError(BAD_LINK);
    setError(null);
    setSaved(null);
    setMulti(null);
    setImported(null);
    start(async () => {
      const fd = new FormData();
      fd.set("url", url);
      const r = await saveAction({}, fd);
      if (r.error || !r.savedId) return setError(r.error ?? "Couldn't save that link. Try again.");
      setValue("");
      setWhy("");
      setNoteDone(false);
      setSaved({ id: r.savedId, host: new URL(url).hostname.replace(/^www\./, "") });
    });
  };

  const importAll = (entries: ImportEntry[]) =>
    start(async () => {
      const r = await importLinksAction(entries);
      setMulti(null);
      setImported(r);
      setValue("");
    });

  // Esc dismisses the "why" prompt.
  useEffect(() => {
    if (!saved) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSaved(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saved]);

  return (
    <section aria-label="Save a link" className="space-y-3">
      <div className="flex flex-wrap items-stretch gap-2">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          e.preventDefault();
          setDragging(false);
          setImporter({ file });
        }}
        className={`flex min-w-[min(100%,18rem)] flex-1 items-center gap-3 rounded-2xl border bg-sheet pl-4 pr-1.5 transition-colors ${
          error ? "border-stamp" : dragging ? "border-pen border-dashed" : "border-rule focus-within:border-pen"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-pencil" aria-hidden>
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
        <label htmlFor="capture" className="sr-only">
          Paste a link to save it
        </label>
        <input
          ref={inputRef}
          id="capture"
          value={value}
          disabled={pending}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const found = parseLinks(text);
            if (found.entries.length > 1) {
              e.preventDefault();
              setValue("");
              setMulti(found.entries);
              setSaved(null);
              setImported(null);
              setError(null);
            } else if (toUrl(text)) {
              e.preventDefault();
              setValue(text.trim());
              save(text);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(value);
            }
          }}
          placeholder={dragging ? "Drop the file to import its links" : "Paste a link to save it"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "capture-error" : undefined}
          className="min-w-0 flex-1 bg-transparent py-4 text-entry text-ink outline-none placeholder:text-pencil disabled:opacity-60"
        />
        <span className="h-6 w-px shrink-0 bg-rule" aria-hidden />
        <button
          type="button"
          onClick={() => save(value)}
          disabled={pending || !value.trim()}
          className="shrink-0 rounded-xl bg-ink/[0.06] px-4 py-2 text-ui font-semibold text-ink hover:bg-ink/10 disabled:text-pencil"
        >
          {pending ? "Saving…" : "Add"}
        </button>
      </div>
      <button
        onClick={() => setImporter((o) => (o ? null : {}))}
        aria-expanded={Boolean(importer)}
        aria-controls="import-panel"
        className={`pill ${importer ? "border-pen text-pen" : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        Import
      </button>
      {toolbar}
      </div>

      {error && (
        <p id="capture-error" role="alert" className="text-ui text-stamp">
          {error}
        </p>
      )}

      {saved && (
        <form
          className="flex flex-col gap-2 rounded-2xl border border-rule bg-sheet px-4 py-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (!why.trim()) return setSaved(null);
            start(async () => {
              await updateWhyAction(saved.id, why);
              setNoteDone(true);
              setTimeout(() => setSaved(null), 1500);
            });
          }}
        >
          <p className="shrink-0 text-ui">
            <span className="text-pen">Saved</span> <span className="text-pencil">{saved.host}.</span>
          </p>
          {noteDone ? (
            <p className="text-ui text-pencil">Note added.</p>
          ) : (
            <>
              <input
                autoFocus
                value={why}
                maxLength={500}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Why are you saving it? Enter to add, Esc to skip"
                aria-label="Why you're saving it"
                className="min-w-0 flex-1 bg-transparent py-1 font-serif text-ui italic text-pen outline-none placeholder:font-sans placeholder:not-italic placeholder:text-pencil"
              />
              <button type="button" onClick={() => setSaved(null)} className="action shrink-0">
                Skip
              </button>
            </>
          )}
        </form>
      )}

      {multi && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-pen bg-sheet px-4 py-3">
          <p className="text-ui">
            You pasted <strong>{multi.length} links</strong>.
          </p>
          <button disabled={pending} onClick={() => importAll(multi)} className="btn">
            {pending ? "Importing…" : `Import all ${multi.length}`}
          </button>
          <button onClick={() => setMulti(null)} className="action">
            Cancel
          </button>
        </div>
      )}

      {imported && (
        <p role="status" className={`text-ui ${imported.error ? "text-stamp" : "text-pen"}`}>
          {imported.error ??
            `Added ${imported.added}${imported.existing ? `, ${imported.existing} already in your library` : ""}${
              imported.invalid ? `, ${imported.invalid} skipped` : ""
            }.`}
        </p>
      )}


      {importer && (
        <div
          id="import-panel"
          role="region"
          aria-label="Import links"
          onKeyDown={(e) => e.key === "Escape" && setImporter(null)}
          className="space-y-4 rounded-2xl border border-pen bg-sheet p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-entry font-semibold">Import links</h2>
              <p className="text-ui text-pencil">Paste a list, or choose a file. Links already in your library are skipped.</p>
            </div>
            <button onClick={() => setImporter(null)} className="action shrink-0">
              Close
            </button>
          </div>
          <BulkImport key={importer.file?.name ?? "paste"} initialFile={importer.file} autoFocus />
        </div>
      )}
    </section>
  );
}
