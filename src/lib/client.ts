type ThemePreference = "light" | "dark" | "system";

type GlobalUiState = {
  registered: boolean;
  pagefindModulePromise?: Promise<typeof import("@lib/pagefind-ui")>;
};

type ReturnScrollRoute = {
  key: string | ((pathname: string) => string);
  sourcePattern: RegExp;
  destinationPattern: RegExp;
};

declare global {
  interface Window {
    __ks1ksiBlogUi?: GlobalUiState;
  }
}

const THEME_STORAGE_KEY = "theme";
const ACTIVE_THEME_CLASSES = ["bg-[var(--color-accent-subtle)]"];
const TOC_OPEN_STORAGE_KEY = "article:toc-open";
const PREVIOUS_PATH_STORAGE_KEY = "navigation:previous-path";
const RETURN_SCROLL_ROUTES: ReturnScrollRoute[] = [
  {
    key: "blog",
    sourcePattern: /^\/blog$/,
    destinationPattern: /^\/blog\/.+/,
  },
  {
    key: "tags",
    sourcePattern: /^\/tags$/,
    destinationPattern: /^\/tags\/[^/]+$/,
  },
  {
    key: (pathname) => `tag:${pathname}`,
    sourcePattern: /^\/tags\/[^/]+$/,
    destinationPattern: /^\/blog\/.+/,
  },
];
const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
].join(", ");

let returnScrollSaveScheduled = false;

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

function normalizePathname(pathname = window.location.pathname) {
  const normalizedPathname = pathname.replace(/\/$/, "");
  return normalizedPathname || "/";
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
  const giscusFrame =
    document.querySelector<HTMLIFrameElement>(".giscus-frame");
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
  return (
    target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR))
  );
}

function getReturnScrollRoute(pathname = window.location.pathname) {
  const normalizedPathname = normalizePathname(pathname);

  for (const route of RETURN_SCROLL_ROUTES) {
    if (route.sourcePattern.test(normalizedPathname)) {
      return route;
    }
  }
}

function getReturnScrollRouteKey(
  route: ReturnScrollRoute,
  pathname = window.location.pathname,
) {
  const normalizedPathname = normalizePathname(pathname);
  return typeof route.key === "function"
    ? route.key(normalizedPathname)
    : route.key;
}

function getReturnScrollStorageKey(routeKey: string) {
  return `return-scroll:${routeKey}:position`;
}

function saveCurrentReturnScrollPosition() {
  const route = getReturnScrollRoute();
  if (!route) return;

  const routeKey = getReturnScrollRouteKey(route);
  sessionStorage.setItem(
    getReturnScrollStorageKey(routeKey),
    String(window.scrollY),
  );
}

function rememberNavigationSource() {
  sessionStorage.setItem(PREVIOUS_PATH_STORAGE_KEY, normalizePathname());
  saveCurrentReturnScrollPosition();
}

function shouldRestoreReturnScroll(route: ReturnScrollRoute) {
  const previousPathname = sessionStorage.getItem(PREVIOUS_PATH_STORAGE_KEY);
  return Boolean(
    previousPathname && route.destinationPattern.test(previousPathname),
  );
}

function restoreReturnScrollPosition() {
  const route = getReturnScrollRoute();
  if (!route) return false;

  if (!shouldRestoreReturnScroll(route)) {
    return false;
  }

  const routeKey = getReturnScrollRouteKey(route);
  const scrollPosition = Number(
    sessionStorage.getItem(getReturnScrollStorageKey(routeKey)),
  );
  if (!Number.isFinite(scrollPosition) || scrollPosition <= 0) {
    return false;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition);
      window.setTimeout(() => window.scrollTo(0, scrollPosition), 50);
    });
  });
  return true;
}

function scrollToHashTarget() {
  if (!window.location.hash) {
    return;
  }

  const target = document.getElementById(
    decodeURIComponent(window.location.hash.slice(1)),
  );
  if (!target) {
    return;
  }

  const scrollToTarget = () => {
    target.scrollIntoView();
    window.setTimeout(() => {
      saveCurrentReturnScrollPosition();
    }, 50);
  };

  window.requestAnimationFrame(scrollToTarget);
  window.setTimeout(scrollToTarget, 50);
}

function scheduleReturnScrollPositionSave() {
  if (!getReturnScrollRoute()) {
    return;
  }

  if (returnScrollSaveScheduled) {
    return;
  }

  returnScrollSaveScheduled = true;
  window.requestAnimationFrame(() => {
    returnScrollSaveScheduled = false;
    saveCurrentReturnScrollPosition();
  });
}

function rememberReturnScrollFromClick(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }

  const link =
    event.target instanceof Element ? event.target.closest("a") : null;
  if (!link?.href || link.target || link.hasAttribute("download")) {
    return;
  }

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) {
    return;
  }

  rememberNavigationSource();
}

function restoreTableOfContentsState() {
  const toc = document.querySelector<HTMLDetailsElement>(
    "details[data-table-of-contents]",
  );
  if (!toc) return;

  const storedOpen = sessionStorage.getItem(TOC_OPEN_STORAGE_KEY);
  if (storedOpen === "true" || storedOpen === "false") {
    toc.open = storedOpen === "true";
  }
}

function storeTableOfContentsState(event: Event) {
  const toc = event.target;
  if (!(toc instanceof HTMLDetailsElement)) {
    return;
  }

  if (!toc.matches("[data-table-of-contents]")) {
    return;
  }

  sessionStorage.setItem(TOC_OPEN_STORAGE_KEY, String(toc.open));
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
  restoreTableOfContentsState();
  const restoredReturnScroll = restoreReturnScrollPosition();
  if (!restoredReturnScroll) {
    scrollToHashTarget();
  }
  enhanceCodeBlocks();
  scheduleSearchPreload();
}

function handleDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;

  rememberReturnScrollFromClick(event);

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

  const backToTopButton =
    event.target.closest<HTMLButtonElement>("#back-to-top");
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

  const searchButton =
    event.target.closest<HTMLButtonElement>("#magnifying-glass");
  if (searchButton) {
    event.preventDefault();
    void openSearch();
    return;
  }

  if (event.target.closest(".pagefind-ui__result-link")) {
    closeSearch();
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
      closeSearch();
      window.location.href = link.href;
    }
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
  history.scrollRestoration = "manual";

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("toggle", storeTableOfContentsState, true);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("astro:after-swap", () =>
    applyTheme(shouldUseDarkTheme()),
  );
  document.addEventListener("astro:before-preparation", () => {
    rememberNavigationSource();
  });
  document.addEventListener("astro:before-swap", closeSearch);
  document.addEventListener("astro:page-load", initializePage);
  window.addEventListener("pagehide", rememberNavigationSource);
  window.addEventListener("pageshow", restoreReturnScrollPosition);
  window.addEventListener("scroll", scheduleReturnScrollPositionSave, {
    passive: true,
  });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", handleSystemThemeChange);

  initializePage();
}
