import { readPreference, writePreference } from "./storage";

const TOC_OPEN_STORAGE_KEY = "article:toc-open";

export function restoreTableOfContentsState(root = document) {
  const toc = root.querySelector<HTMLDetailsElement>(
    "details[data-table-of-contents]",
  );
  if (!toc) return;

  const storedOpen = readPreference("session", TOC_OPEN_STORAGE_KEY);
  if (storedOpen === "true" || storedOpen === "false") {
    toc.open = storedOpen === "true";
  }
}

export function storeTableOfContentsState(event: Event) {
  const toc = event.target;
  if (
    toc instanceof HTMLDetailsElement &&
    toc.matches("[data-table-of-contents]")
  ) {
    writePreference("session", TOC_OPEN_STORAGE_KEY, String(toc.open));
  }
}
