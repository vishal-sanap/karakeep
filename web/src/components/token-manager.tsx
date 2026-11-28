"use client";
import { useState, useTransition } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/actions";
import { LocalDate } from "./local-date";

type Token = { id: string; name: string; created_at: string; last_used_at: string | null };

export function TokenManager({ tokens }: { tokens: Token[] }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="rounded-md border border-pen p-3 text-ui">
          <p className="mb-1 font-semibold">Copy this token now. It won&apos;t be shown again.</p>
          <code className="block break-all select-all text-pen">{fresh}</code>
        </div>
      )}
      <ul className="divide-y divide-rule text-ui">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            <span>
              {t.name}
              <span className="ml-2 text-meta text-pencil">
                created <LocalDate value={t.created_at} />
                {t.last_used_at ? (<>, last used <LocalDate value={t.last_used_at} /></>) : ", never used"}
              </span>
            </span>
            <button
              disabled={pending}
              onClick={() => start(() => revokeTokenAction(t.id))}
              className="action hover:text-stamp"
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
        className="btn-quiet"
      >
        Create token
      </button>
    </div>
  );
}
