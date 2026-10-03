import { PagefindUI } from "@pagefind/default-ui";
import pagefindUiStyles from "@pagefind/default-ui/css/ui.css?url";
import { ensureStylesheet } from "./client/stylesheet";
import { loadPagefindEngine, resetPagefindEngine } from "./pagefind-engine";

const SEARCH_ROOT_SELECTOR = "#search";
const BUNDLE_PATH = `${import.meta.env.BASE_URL}pagefind/`;
const PAGEFIND_STYLESHEET_ID = "pagefind-ui-styles";
const PAGEFIND_OVERRIDES_ID = "pagefind-ui-overrides";

let pagefindUi: PagefindUI | null = null;
let pagefindRoot: HTMLElement | null = null;
let rootTeardown: Promise<void> | null = null;

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
  const root = document.querySelector<HTMLElement>(SEARCH_ROOT_SELECTOR);
  if (!root) return null;

  if (rootTeardown) await rootTeardown;
  if (pagefindRoot !== root && pagefindUi) {
    const previousUi = pagefindUi;
    rootTeardown = resetPagefindEngine(() => {
      previousUi.destroy();
      pagefindUi = null;
      pagefindRoot = null;
    }).finally(() => {
      rootTeardown = null;
    });
    await rootTeardown;
  }
  if (
    !root.isConnected ||
    root !== document.querySelector(SEARCH_ROOT_SELECTOR)
  ) {
    return null;
  }
  pagefindRoot = root;

  await Promise.all([
    ensureStylesheet(PAGEFIND_STYLESHEET_ID, pagefindUiStyles),
    loadPagefindEngine(),
  ]);
  // Do not mount into another page when an earlier open/preload was interrupted.
  if (
    !root.isConnected ||
    root !== document.querySelector(SEARCH_ROOT_SELECTOR)
  ) {
    return null;
  }
  ensurePagefindOverrides();

  if (!pagefindUi) {
    pagefindUi = new PagefindUI({
      element: root,
      bundlePath: BUNDLE_PATH,
      showImages: false,
      excerptLength: 15,
      resetStyles: false,
      translations: {
        placeholder: "검색어를 입력하세요",
        clear_search: "지우기",
        load_more: "결과 더 보기",
        search_label: "블로그 검색",
        zero_results: "‘[SEARCH_TERM]’ 검색 결과가 없습니다",
        many_results: "‘[SEARCH_TERM]’ 검색 결과 [COUNT]개",
        one_result: "‘[SEARCH_TERM]’ 검색 결과 [COUNT]개",
        alt_search:
          "‘[SEARCH_TERM]’ 대신 ‘[DIFFERENT_TERM]’ 검색 결과를 표시합니다",
        search_suggestion:
          "‘[SEARCH_TERM]’ 검색 결과가 없습니다. 다른 검색어를 입력해 보세요:",
        searching: "‘[SEARCH_TERM]’ 검색 중…",
      },
    });
  }

  return pagefindUi;
}
