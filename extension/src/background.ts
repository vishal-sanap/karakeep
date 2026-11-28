import { canSave, NotConfiguredError, saveToUnfold, selectionAsNote, TokenRejectedError } from "./api";

/**
 * Right-click saving. Feedback goes on the toolbar icon: a short badge
 * (✓ saved, = already saved, ! error) and the error in the icon's tooltip.
 */

const MENU = {
  page: "save-page",
  link: "save-link",
  selection: "save-selection",
} as const;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU.page, title: "Save this page to unfold", contexts: ["page", "frame", "image", "video"] });
    chrome.contextMenus.create({ id: MENU.link, title: "Save this link to unfold", contexts: ["link"] });
    chrome.contextMenus.create({ id: MENU.selection, title: "Save page with “%s” as the note", contexts: ["selection"] });
  });
});

const DEFAULT_TITLE = "Save to unfold";

async function flash(tabId: number | undefined, text: string, color: string, title = DEFAULT_TITLE) {
  const target = tabId !== undefined ? { tabId } : {};
  await chrome.action.setBadgeBackgroundColor({ ...target, color });
  await chrome.action.setBadgeText({ ...target, text });
  await chrome.action.setTitle({ ...target, title });
  setTimeout(() => {
    void chrome.action.setBadgeText({ ...target, text: "" });
    void chrome.action.setTitle({ ...target, title: DEFAULT_TITLE });
  }, text === "!" ? 6000 : 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === MENU.link ? info.linkUrl : (info.pageUrl ?? tab?.url);
  const note = info.menuItemId === MENU.selection ? selectionAsNote(info.selectionText) : null;
  const tabId = tab?.id;

  if (!canSave(url)) {
    await flash(tabId, "!", "#b4372f", "This kind of page can't be saved.");
    return;
  }
  try {
    const { created } = await saveToUnfold(url!, note);
    await flash(tabId, created ? "✓" : "=", created ? "#2b47b5" : "#646b72", created ? "Saved to unfold" : "Already in your library");
  } catch (err) {
    if (err instanceof NotConfiguredError) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    const message = err instanceof TokenRejectedError || err instanceof Error ? err.message : "Couldn't reach unfold.";
    // fetch() throws TypeError when the app isn't reachable (e.g. not running).
    await flash(tabId, "!", "#b4372f", err instanceof TypeError ? "Couldn't reach unfold. Is it running?" : message);
  }
});
