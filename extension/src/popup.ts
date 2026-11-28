import { canSave, NotConfiguredError, saveToUnfold, selectionAsNote } from "./api";
import { getSettings } from "./storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $<HTMLParagraphElement>("status");
const setStatus = (msg: string, kind: "" | "ok" | "err" = "") => {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
};

$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

/** Text highlighted on the page, if any (needs activeTab + scripting; fails quietly on restricted pages). */
async function pageSelection(tabId: number): Promise<string | null> {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.getSelection()?.toString() ?? "" });
    return selectionAsNote(res?.result as string | undefined);
  } catch {
    return null;
  }
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const why = $<HTMLTextAreaElement>("why");
  const button = $<HTMLButtonElement>("save");

  $("title").textContent = tab?.title || url || "This page";
  try {
    $("domain").textContent = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    $("domain").textContent = "";
  }
  if (tab?.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) {
    const img = document.createElement("img");
    img.src = tab.favIconUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.replaceWith($("favicon"));
    $("favicon").replaceWith(img);
  }

  if (!canSave(url)) {
    button.disabled = true;
    why.disabled = true;
    setStatus("Only web pages (http or https) can be saved.", "err");
    return;
  }
  const settings = await getSettings();
  if (!settings) {
    button.disabled = true;
    setStatus("Connect the extension to unfold first. Opening settings…", "err");
    setTimeout(() => chrome.runtime.openOptionsPage(), 800);
    return;
  }

  // Pre-fill the note with whatever you highlighted.
  if (tab?.id !== undefined) {
    const sel = await pageSelection(tab.id);
    if (sel) why.value = sel;
  }
  why.focus();
  why.setSelectionRange(why.value.length, why.value.length);

  const submit = async () => {
    button.disabled = true;
    setStatus("Saving…");
    try {
      const { created } = await saveToUnfold(url, why.value);
      $<HTMLAnchorElement>("open-library").href = settings.baseUrl;
      $("done-text").textContent = created ? "Saved to your library." : "Already in your library.";
      $("form").style.display = "none";
      $("done").classList.add("show");
      setTimeout(() => window.close(), 1600);
    } catch (err) {
      if (err instanceof NotConfiguredError) chrome.runtime.openOptionsPage();
      setStatus(err instanceof TypeError ? "Couldn't reach unfold. Is it running?" : err instanceof Error ? err.message : "Save failed.", "err");
      button.disabled = false;
    }
  };

  $<HTMLFormElement>("form").addEventListener("submit", (e) => {
    e.preventDefault();
    void submit();
  });
  why.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void submit();
    }
  });
}

void main();
