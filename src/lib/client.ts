import { navigate } from "astro:transitions/client";
import { initBlogIndexState, restoreBlogIndexState } from "./blog-index-state";
import { enhanceCodeBlocks, copyCode } from "./client/code-copy";
import {
  restoreTableOfContentsState,
  storeTableOfContentsState,
} from "./client/disclosures";
import {
  closeSearch,
  getSearchDialog,
  handleSearchClose,
  handleSearchPreloadIntent,
  openSearch,
} from "./client/search";
import {
  handleSystemThemeChange,
  initializeTheme,
  selectTheme,
} from "./client/theme";

declare global {
  interface Window {
    __ks1ksiBlogUi?: { registered: boolean };
  }
}

const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
].join(", ");

function initializePage() {
  initializeTheme();
  restoreTableOfContentsState();
  initBlogIndexState();
  enhanceCodeBlocks();
}

function handleDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;

  const themeButton =
    event.target.closest<HTMLButtonElement>("[data-theme-value]");
  if (themeButton) {
    selectTheme(themeButton);
    return;
  }

  const copyButton = event.target.closest<HTMLButtonElement>(".copy-code");
  if (copyButton) {
    event.preventDefault();
    void copyCode(copyButton);
    return;
  }

  if (event.target.closest("#magnifying-glass, #search-retry")) {
    event.preventDefault();
    void openSearch();
    return;
  }

  if (event.target.closest("#search-reload")) {
    event.preventDefault();
    window.location.reload();
    return;
  }

  if (event.target.closest("#search-close")) {
    event.preventDefault();
    closeSearch();
    return;
  }

  if (event.target.closest(".pagefind-ui__result-link")) {
    closeSearch({ restoreFocus: false });
    return;
  }

  const searchResult = event.target.closest<HTMLElement>(
    ".pagefind-ui__result",
  );
  if (searchResult && !event.target.closest("a, button, input")) {
    const link = searchResult.querySelector<HTMLAnchorElement>(
      ".pagefind-ui__result-link",
    );
    if (link?.href) {
      event.preventDefault();
      closeSearch({ restoreFocus: false });
      void navigate(link.href);
    }
    return;
  }

  const dialog = getSearchDialog();
  if (dialog?.open && event.target === dialog) closeSearch();
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeSearch();
    return;
  }
  if (
    event.target instanceof Element &&
    event.target.closest(EDITABLE_SELECTOR)
  )
    return;

  const isSlashShortcut = event.key === "/";
  const isSearchShortcut =
    (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
  if (!isSlashShortcut && !isSearchShortcut) return;

  event.preventDefault();
  void openSearch();
}

export function registerGlobalUi() {
  window.__ks1ksiBlogUi ??= { registered: false };
  if (window.__ks1ksiBlogUi.registered) return;
  window.__ks1ksiBlogUi.registered = true;

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("toggle", storeTableOfContentsState, true);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("pointerover", handleSearchPreloadIntent);
  document.addEventListener("focusin", handleSearchPreloadIntent);
  document.addEventListener("astro:after-swap", initializeTheme);
  document.addEventListener("astro:before-swap", (event) => {
    closeSearch({ restoreFocus: false });
    // Restore disclosure layout before the router restores its scroll position.
    restoreBlogIndexState(event.newDocument);
    restoreTableOfContentsState(event.newDocument);
  });
  document.addEventListener("astro:page-load", initializePage);
  document.addEventListener("close", handleSearchClose, true);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", handleSystemThemeChange);
  initializePage();
}
