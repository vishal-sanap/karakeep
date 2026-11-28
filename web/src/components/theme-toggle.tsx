"use client";
import { useEffect, useState } from "react";

const KEY = "unfold-theme";

/**
 * Runs before first paint (inlined in <head>) so the saved theme applies
 * without a flash. No saved choice: follow the system.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function resolved(): "light" | "dark" {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Switches between light and dark; the choice is remembered on this device. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(resolved()), []);

  const toggle = () => {
    const next = resolved() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: the switch still works for this visit
    }
    setTheme(next);
  };

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full text-pencil hover:bg-ink/5 hover:text-ink"
    >
      {theme === "dark" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        </svg>
      )}
    </button>
  );
}

/** Dark mode as a labelled switch, for menus. */
export function ThemeSwitch() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(resolved() === "dark"), []);
  const flip = () => {
    const next = resolved() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: still applies for this visit
    }
    setDark(next === "dark");
  };
  return (
    <button role="menuitemcheckbox" aria-checked={Boolean(dark)} onClick={flip} className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-ui hover:bg-ink/5">
      Dark mode
      <span aria-hidden className={`relative h-5 w-9 rounded-full transition-colors ${dark ? "bg-pen" : "bg-rule"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-[left] ${dark ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
