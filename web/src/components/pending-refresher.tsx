"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While items are still being processed, refresh the list every few seconds. */
export function PendingRefresher() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 20) return clearInterval(t);
      router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
