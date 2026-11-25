"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rebuildThreadsAction } from "@/app/actions";

/** Queues a rebuild, then refreshes a few times so new threads appear. */
export function RebuildThreads() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await rebuildThreadsAction();
            if (!r.ok) return setMsg("Couldn't start a rebuild. Is the worker running?");
            setMsg("Rebuilding…");
            for (const ms of [2000, 4000, 8000]) {
              await new Promise((res) => setTimeout(res, ms));
              router.refresh();
            }
            setMsg(null);
          })
        }
        className="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        Rebuild threads
      </button>
      {msg && <span className="text-xs text-stone-500">{msg}</span>}
    </div>
  );
}
