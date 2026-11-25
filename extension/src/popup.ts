import { getSettings } from "./storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $<HTMLParagraphElement>("status");
const setStatus = (msg: string, kind: "" | "ok" | "err" = "") => {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
};

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  $("page").textContent = tab?.title || url;

  const form = $<HTMLFormElement>("form");
  const button = $<HTMLButtonElement>("save");

  if (!/^https?:\/\//.test(url)) {
    button.disabled = true;
    setStatus("This page can't be saved.", "err");
    return;
  }

  const settings = await getSettings();
  if (!settings) {
    button.disabled = true;
    setStatus("Set your app URL and token in the extension options.", "err");
    chrome.runtime.openOptionsPage();
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    button.disabled = true;
    setStatus("Saving…");
    try {
      const res = await fetch(new URL("/api/discoveries", settings.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${settings.token}` },
        body: JSON.stringify({ url, why_note: $<HTMLInputElement>("why").value }),
      });
      if (res.status === 401) throw new Error("Token rejected. Check the extension options.");
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const body = (await res.json()) as { created: boolean };
      setStatus(body.created ? "Saved." : "Already in your library.", "ok");
      setTimeout(() => window.close(), 900);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed", "err");
      button.disabled = false;
    }
  });
}

void main();
