"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const next = params.get("next") ?? "/";
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return <p className="text-ui">Check your email for a sign-in link. It works once, on this device.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="field"
      />
      <button
        disabled={state === "sending"}
        className="btn w-full"
      >
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && <p className="text-ui text-stamp">That link didn&apos;t work. Request a new one.</p>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Sign in</h1>
        <p className="lede">Save what you find interesting, and why. Find it again later.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
