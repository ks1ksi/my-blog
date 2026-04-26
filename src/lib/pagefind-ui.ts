import { PagefindUI } from "@pagefind/default-ui";
import pagefindUiStyles from "@pagefind/default-ui/css/ui.css?url";

const SEARCH_ROOT_SELECTOR = "#search";
const BUNDLE_PATH = `${import.meta.env.BASE_URL}pagefind/`;
const PAGEFIND_STYLESHEET_ID = "pagefind-ui-styles";
const PAGEFIND_OVERRIDES_ID = "pagefind-ui-overrides";

let pagefindUi: PagefindUI | null = null;
let pagefindStylesPromise: Promise<void> | null = null;

function waitForStylesheet(stylesheet: HTMLLinkElement) {
  if (stylesheet.sheet) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    stylesheet.addEventListener("load", () => resolve(), { once: true });
    stylesheet.addEventListener(
      "error",
      () => {
        pagefindStylesPromise = null;
        stylesheet.remove();
        reject(new Error("Failed to load Pagefind UI styles."));
      },
      { once: true },
    );
  });
}

function ensurePagefindStyles() {
  if (pagefindStylesPromise) {
    return pagefindStylesPromise;
  }

  const existingStylesheet = document.getElementById(PAGEFIND_STYLESHEET_ID);
  if (existingStylesheet) {
    if (existingStylesheet instanceof HTMLLinkElement) {
      pagefindStylesPromise = waitForStylesheet(existingStylesheet);
      return pagefindStylesPromise;
    }

    return Promise.resolve();
  }

  pagefindStylesPromise = new Promise((resolve, reject) => {
    const stylesheet = document.createElement("link");
    stylesheet.id = PAGEFIND_STYLESHEET_ID;
    stylesheet.rel = "stylesheet";
    stylesheet.href = pagefindUiStyles;
    stylesheet.addEventListener("load", () => resolve(), { once: true });
    stylesheet.addEventListener(
      "error",
      () => {
        pagefindStylesPromise = null;
        stylesheet.remove();
        reject(new Error("Failed to load Pagefind UI styles."));
      },
      { once: true },
    );
    document.head.appendChild(stylesheet);
  });

  return pagefindStylesPromise;
}

function ensurePagefindOverrides() {
  if (document.getElementById(PAGEFIND_OVERRIDES_ID)) {
    return;
  }

  const stylesheetOverrides = document.createElement("style");
  stylesheetOverrides.id = PAGEFIND_OVERRIDES_ID;
  stylesheetOverrides.textContent = `
    #search .pagefind-ui__form::before {
      display: none !important;
    }

    #search .pagefind-ui__search-clear {
      display: none !important;
    }
  `;
  document.head.appendChild(stylesheetOverrides);
}

export async function ensurePagefindUi() {
  if (!document.querySelector(SEARCH_ROOT_SELECTOR)) {
    return null;
  }

  await ensurePagefindStyles();
  ensurePagefindOverrides();

  if (!pagefindUi) {
    pagefindUi = new PagefindUI({
      element: SEARCH_ROOT_SELECTOR,
      bundlePath: BUNDLE_PATH,
      showImages: false,
      excerptLength: 15,
      resetStyles: false,
    });
  }

  return pagefindUi;
}
