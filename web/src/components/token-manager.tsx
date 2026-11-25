"use client";
import { useState, useTransition } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/actions";

type Token = { id: string; name: string; created_at: string; last_used_at: string | null };

export function TokenManager({ tokens }: { tokens: Token[] }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p className="mb-1 font-medium">Copy this token now. It won&apos;t be shown again.</p>
          <code className="block break-all select-all">{fresh}</code>
        </div>
      )}
      <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            <span>
              {t.name}
              <span className="ml-2 text-xs text-stone-500">
                created {new Date(t.created_at).toLocaleDateString()}
                {t.last_used_at ? `, last used ${new Date(t.last_used_at).toLocaleDateString()}` : ", never used"}
              </span>
            </span>
            <button
              disabled={pending}
              onClick={() => start(() => revokeTokenAction(t.id))}
              className="text-xs text-red-600"
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { token } = await createTokenAction();
            setFresh(token ?? null);
          })
        }
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium dark:border-stone-700"
      >
        Create token
      </button>
    </div>
  );
}
