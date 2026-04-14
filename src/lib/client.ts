type ThemePreference = "light" | "dark" | "system";

type GlobalUiState = {
  registered: boolean;
  pagefindModulePromise?: Promise<typeof import("@lib/pagefind-ui")>;
};

declare global {
  interface Window {
    __ks1ksiBlogUi?: GlobalUiState;
  }
}

const THEME_STORAGE_KEY = "theme";
const ACTIVE_THEME_CLASSES = ["bg-[var(--color-accent-subtle)]"];
const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
].join(", ");

function getState() {
  window.__ks1ksiBlogUi ??= {
    registered: false,
  };

  return window.__ks1ksiBlogUi;
}

function getStoredTheme(): ThemePreference {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);

  if (theme === "light" || theme === "dark") {
    return theme;
  }

  return "system";
}

function prefersDarkTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function shouldUseDarkTheme(theme = getStoredTheme()) {
  return theme === "dark" || (theme === "system" && prefersDarkTheme());
}

function withTransitionsDisabled(callback: () => void) {
  const css = document.createElement("style");
  css.textContent = `* {
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
    -ms-transition: none !important;
    transition: none !important;
  }`;

  document.head.appendChild(css);
  callback();
  window.getComputedStyle(css).opacity;
  document.head.removeChild(css);
}

function syncGiscusTheme() {
  const giscusFrame = document.querySelector<HTMLIFrameElement>(".giscus-frame");
  if (!giscusFrame) return;

  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const url = new URL(giscusFrame.src);

  if (url.searchParams.get("theme") === theme) {
    return;
  }

  url.searchParams.set("theme", theme);
  giscusFrame.src = url.toString();
}

function applyTheme(dark: boolean, disableTransitions = true) {
  const syncDocumentTheme = () => {
    document.documentElement.classList.toggle("dark", dark);
    syncGiscusTheme();
  };

  if (disableTransitions) {
    withTransitionsDisabled(syncDocumentTheme);
    return;
  }

  syncDocumentTheme();
}

function updateThemeButtons() {
  const activeThemeButtonId =
    getStoredTheme() === "light"
      ? "light-theme-button"
      : getStoredTheme() === "dark"
        ? "dark-theme-button"
        : "system-theme-button";

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#light-theme-button, #dark-theme-button, #system-theme-button",
  )) {
    button.classList.remove(...ACTIVE_THEME_CLASSES);
    if (button.id === activeThemeButtonId) {
      button.classList.add(...ACTIVE_THEME_CLASSES);
    }
  }
}

function getSearchBackdrop() {
  return document.querySelector<HTMLElement>("#backdrop");
}

function getSearchInput() {
  return document.querySelector<HTMLInputElement>("#search input[type='text']");
}

function clearSearch() {
  const input = getSearchInput();
  if (!input) return;

  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function loadPagefindUi() {
  const state = getState();
  state.pagefindModulePromise ??= import("@lib/pagefind-ui");
  return state.pagefindModulePromise;
}

async function openSearch() {
  const backdrop = getSearchBackdrop();
  if (!backdrop) return;

  backdrop.classList.remove("invisible");
  backdrop.classList.add("visible");

  const { ensurePagefindUi } = await loadPagefindUi();
  await ensurePagefindUi();

  window.requestAnimationFrame(() => {
    getSearchInput()?.focus();
  });
}

function closeSearch() {
  clearSearch();

  const backdrop = getSearchBackdrop();
  backdrop?.classList.remove("visible");
  backdrop?.classList.add("invisible");
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));
}

function enhanceCodeBlocks() {
  for (const codeBlock of document.querySelectorAll<HTMLElement>(
    "article pre:not([data-copy-ready])",
  )) {
    const wrapper = document.createElement("div");
    wrapper.className = "copy-code-wrapper";

    codeBlock.dataset.copyReady = "true";
    codeBlock.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-code";
    copyButton.setAttribute("aria-label", "Copy code");
    copyButton.textContent = "Copy";

    codeBlock.appendChild(copyButton);
  }
}

async function copyCode(copyButton: HTMLButtonElement) {
  const codeBlock = copyButton.closest("pre");
  if (!codeBlock) return;

  const clone = codeBlock.cloneNode(true) as HTMLElement;
  clone.querySelector(".copy-code")?.remove();

  await navigator.clipboard.writeText((clone.textContent ?? "").trimEnd());
  copyButton.textContent = "Copied";

  window.setTimeout(() => {
    if (copyButton.isConnected) {
      copyButton.textContent = "Copy";
    }
  }, 2000);
}

function preloadSearch() {
  void loadPagefindUi().then(({ ensurePagefindUi }) => ensurePagefindUi());
}

function scheduleSearchPreload() {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(preloadSearch);
  } else {
    window.setTimeout(preloadSearch, 200);
  }
}

function initializePage() {
  applyTheme(shouldUseDarkTheme(), false);
  updateThemeButtons();
  enhanceCodeBlocks();
  scheduleSearchPreload();
}

function handleDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;

  const themeButton = event.target.closest<HTMLButtonElement>(
    "#light-theme-button, #dark-theme-button, #system-theme-button",
  );
  if (themeButton) {
    const nextTheme: ThemePreference =
      themeButton.id === "light-theme-button"
        ? "light"
        : themeButton.id === "dark-theme-button"
          ? "dark"
          : "system";

    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(shouldUseDarkTheme(nextTheme));
    updateThemeButtons();
    return;
  }

  const backToTopButton = event.target.closest<HTMLButtonElement>("#back-to-top");
  if (backToTopButton) {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    return;
  }

  const copyButton = event.target.closest<HTMLButtonElement>(".copy-code");
  if (copyButton) {
    event.preventDefault();
    void copyCode(copyButton);
    return;
  }

  const searchButton = event.target.closest<HTMLButtonElement>("#magnifying-glass");
  if (searchButton) {
    event.preventDefault();
    void openSearch();
    return;
  }

  if (event.target.closest(".pagefind-ui__result-link")) {
    closeSearch();
    return;
  }

  const backdrop = event.target.closest<HTMLElement>("#backdrop");
  if (backdrop && !event.target.closest("#pagefind-container")) {
    closeSearch();
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeSearch();
    return;
  }

  if (isEditableTarget(event.target)) {
    return;
  }

  const isSlashShortcut = event.key === "/";
  const isSearchShortcut =
    (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

  if (!isSlashShortcut && !isSearchShortcut) {
    return;
  }

  event.preventDefault();
  void openSearch();
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  if (getStoredTheme() !== "system") {
    return;
  }

  applyTheme(event.matches);
  updateThemeButtons();
}

export function registerGlobalUi() {
  const state = getState();
  if (state.registered) {
    return;
  }

  state.registered = true;

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("astro:after-swap", () =>
    applyTheme(shouldUseDarkTheme()),
  );
  document.addEventListener("astro:before-swap", closeSearch);
  document.addEventListener("astro:page-load", initializePage);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", handleSystemThemeChange);
}
