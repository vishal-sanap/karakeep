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
            if (!r.ok) return setMsg("Couldn't start. Is the worker running?");
            setMsg("Regrouping…");
            for (const ms of [2000, 4000, 8000]) {
              await new Promise((res) => setTimeout(res, ms));
              router.refresh();
            }
            setMsg(null);
          })
        }
        className="btn-quiet"
      >
        Regroup now
      </button>
      {msg && <span className="text-meta text-pencil">{msg}</span>}
    </div>
  );
}
