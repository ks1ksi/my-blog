import { createRetryableLoader } from "./retryable-loader";
import { trackSearchViewport } from "./search-viewport";

const loadPagefindUi = createRetryableLoader(() => import("../pagefind-ui"));
let searchTrigger: HTMLElement | null = null;
let openAttempt = 0;
let stopTrackingViewport: (() => void) | undefined;

export function getSearchDialog() {
  return document.querySelector<HTMLDialogElement>("#search-dialog");
}

function getSearchInput(dialog = getSearchDialog()) {
  return dialog?.querySelector<HTMLInputElement>("#search input[type='text']");
}

function updateSearchStatus(
  dialog: HTMLDialogElement,
  state: "loading" | "error" | "ready",
) {
  let status = dialog.querySelector<HTMLElement>("#search-load-status");
  if (!status) {
    status = document.createElement("div");
    status.id = "search-load-status";
    status.className = "search-help";
    status.setAttribute("aria-live", "polite");
    const message = document.createElement("p");
    const retry = document.createElement("button");
    retry.id = "search-retry";
    retry.type = "button";
    retry.textContent = "다시 시도";
    const reload = document.createElement("button");
    reload.id = "search-reload";
    reload.type = "button";
    reload.textContent = "페이지 새로고침";
    status.append(message, retry, reload);
    dialog.querySelector("#search")?.before(status);
  }

  status.hidden = state === "ready";
  status.setAttribute("role", state === "error" ? "alert" : "status");
  const message = status.querySelector("p");
  if (message) {
    message.textContent =
      state === "error"
        ? "검색을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요. 계속 실패하면 페이지를 새로고침해 주세요."
        : "검색을 불러오는 중…";
  }
  const retry = status.querySelector<HTMLButtonElement>("#search-retry");
  if (retry) retry.hidden = state !== "error";
  const reload = status.querySelector<HTMLButtonElement>("#search-reload");
  if (reload) reload.hidden = state !== "error";
  const search = dialog.querySelector<HTMLElement>("#search");
  if (search) {
    search.hidden = state !== "ready";
    search.setAttribute("aria-busy", String(state === "loading"));
  }
}

export async function openSearch(trigger?: HTMLElement) {
  const dialog = getSearchDialog();
  if (!dialog) return;

  if (!dialog.open) {
    // Pointer activation does not focus buttons in Safari. Remember the
    // explicit opener, while keyboard shortcuts keep their existing focus.
    searchTrigger =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    stopTrackingViewport?.();
    stopTrackingViewport = trackSearchViewport(dialog);
    dialog.showModal();
  }

  const attempt = ++openAttempt;
  const isCurrent = () =>
    attempt === openAttempt &&
    dialog.isConnected &&
    dialog.open &&
    dialog === getSearchDialog();
  updateSearchStatus(dialog, "loading");

  try {
    const { ensurePagefindUi } = await loadPagefindUi();
    if (!isCurrent()) return;
    const ui = await ensurePagefindUi();
    if (!isCurrent() || !ui) return;
    updateSearchStatus(dialog, "ready");
    window.requestAnimationFrame(() => {
      if (isCurrent()) getSearchInput(dialog)?.focus();
    });
  } catch {
    if (!isCurrent()) return;
    updateSearchStatus(dialog, "error");
    dialog.querySelector<HTMLButtonElement>("#search-retry")?.focus();
  }
}

export function finishSearchClose({ restoreFocus = true } = {}) {
  // Invalidates pending imports, stylesheet loads and scheduled focus callbacks.
  ++openAttempt;
  stopTrackingViewport?.();
  stopTrackingViewport = undefined;
  const input = getSearchInput();
  if (input) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (restoreFocus && searchTrigger?.isConnected) searchTrigger.focus();
  searchTrigger = null;
}

export function closeSearch({ restoreFocus = true } = {}) {
  const dialog = getSearchDialog();
  if (dialog?.open) dialog.close();
  finishSearchClose({ restoreFocus });
}

export function handleSearchClose(event: Event) {
  const dialog = getSearchDialog();
  // A queued close event from an earlier open must not cancel a new opening.
  if (event.target === dialog && !dialog?.open) finishSearchClose();
}

export function handleSearchPreloadIntent(event: Event) {
  if (
    event.target instanceof Element &&
    event.target.closest("#magnifying-glass")
  ) {
    // Speculative loading must never leak an unhandled rejection. A real open
    // retries failed imports/styles and presents an actionable error if needed.
    void loadPagefindUi()
      .then(({ ensurePagefindUi }) => ensurePagefindUi())
      .catch(() => {});
  }
}
