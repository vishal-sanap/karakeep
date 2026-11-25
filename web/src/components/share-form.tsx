"use client";
import { useActionState } from "react";
import { shareSaveAction, type SaveState } from "@/app/actions";

export function ShareForm({ url }: { url: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(shareSaveAction, {});
  return (
    <form action={action} className="space-y-3">
      <input
        name="url"
        type="url"
        required
        defaultValue={url}
        placeholder="https://…"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      <input
        name="why_note"
        autoFocus
        maxLength={500}
        placeholder="Why? (optional, one line)"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      <button
        disabled={pending}
        className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
