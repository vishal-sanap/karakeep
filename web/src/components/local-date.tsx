"use client";
import { useEffect, useState } from "react";

const fmt = (iso: string | Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(
    new Date(iso),
  );

/**
 * Renders a date identically on server and client (fixed locale, UTC) to avoid
 * hydration mismatches, then switches to the viewer's own timezone after mount.
 */
export function LocalDate({ value }: { value: string | Date }) {
  const [text, setText] = useState(() => fmt(value, "UTC"));
  useEffect(() => setText(fmt(value)), [value]);
  return <time dateTime={new Date(value).toISOString()}>{text}</time>;
}
