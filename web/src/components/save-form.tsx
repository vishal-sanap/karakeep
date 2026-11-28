"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveAction, type SaveState } from "@/app/actions";

export function SaveForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.savedId) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex gap-2">
        <input
          name="url"
          type="url"
          required
          placeholder="Paste a link"
          className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-700"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <input
        name="why_note"
        maxLength={500}
        placeholder="Why? (optional, one line)"
        className="w-full rounded-lg border border-transparent bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-stone-400 focus:border-stone-300 dark:focus:border-stone-700"
      />
      {state.error && <p className="px-1 text-sm text-red-600">{state.error}</p>}
      <a href="/settings#import" className="block px-1 text-xs text-stone-500 hover:underline">
        Have a bunch of links? Import them all at once
      </a>
    </form>
  );
}
