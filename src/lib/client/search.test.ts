// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ensurePagefindUi = vi.hoisted(() => vi.fn());
vi.mock("../pagefind-ui", () => ({ ensurePagefindUi }));
let frames: FrameRequestCallback[];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML =
    '<button id="magnifying-glass">검색</button><dialog id="search-dialog"><button id="search-close">닫기</button><div id="search"></div></dialog>';
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  ensurePagefindUi.mockImplementation(async () => {
    document.querySelector("#search")!.innerHTML = '<input type="text">';
    return {};
  });
});
afterEach(() => vi.restoreAllMocks());

function trigger() {
  return document.querySelector<HTMLButtonElement>("#magnifying-glass")!;
}
function dialog() {
  return document.querySelector<HTMLDialogElement>("#search-dialog")!;
}
function input() {
  return document.querySelector<HTMLInputElement>("#search input")!;
}

function eventOn(type: string, target: HTMLElement) {
  const event = new Event(type);
  Object.defineProperty(event, "target", { value: target });
  return event;
}

function deferred() {
  let resolve!: (value: object) => void;
  const promise = new Promise<object>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("search open, close and retry", () => {
  it("restores an explicit pointer opener even when clicking did not focus it", async () => {
    const search = await import("./search");
    expect(document.activeElement).toBe(document.body);
    await search.openSearch(trigger());
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(input());
    search.closeSearch();
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it("restores the previously focused control for a keyboard shortcut", async () => {
    const previous = document.createElement("a");
    previous.href = "/blog/";
    document.body.prepend(previous);
    previous.focus();
    const search = await import("./search");
    await search.openSearch();
    frames.forEach((frame) => frame(0));
    search.closeSearch();
    expect(document.activeElement).toBe(previous);
  });

  it("opens repeatedly without replacing the original focus target", async () => {
    const search = await import("./search");
    trigger().focus();
    await search.openSearch();
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(input());
    await search.openSearch();
    search.closeSearch();
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
    expect(input().value).toBe("");
  });

  it("shows an accessible error with retry and refresh, then recovers", async () => {
    ensurePagefindUi.mockRejectedValueOnce(new Error("offline"));
    const search = await import("./search");
    await search.openSearch(trigger());
    const status = document.querySelector<HTMLElement>("#search-load-status")!;
    expect(status.getAttribute("role")).toBe("alert");
    expect(status.textContent).toContain("검색을 불러오지 못했습니다");
    expect(document.activeElement?.id).toBe("search-retry");
    expect(
      document.querySelector<HTMLButtonElement>("#search-reload")!.hidden,
    ).toBe(false);
    await search.openSearch(
      document.querySelector<HTMLButtonElement>("#search-retry")!,
    );
    expect(status.hidden).toBe(true);
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(input());
    search.closeSearch();
    expect(document.activeElement).toBe(trigger());
  });

  it("does not refocus a dialog closed while search was loading", async () => {
    const waiting = deferred();
    ensurePagefindUi.mockReturnValueOnce(waiting.promise);
    const search = await import("./search");
    expect(document.activeElement).toBe(document.body);
    const opening = search.openSearch(trigger());
    await vi.waitFor(() => expect(ensurePagefindUi).toHaveBeenCalledOnce());
    search.closeSearch();
    waiting.resolve({});
    await opening;
    expect(dialog().open).toBe(false);
    // Only the close focus recovery can be queued, never a stale input focus.
    expect(frames).toHaveLength(1);
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(trigger());
  });

  it("consumes Escape while search is loading before native default handling", async () => {
    const waiting = deferred();
    ensurePagefindUi.mockReturnValueOnce(waiting.promise);
    const search = await import("./search");
    const opening = search.openSearch(trigger());
    await vi.waitFor(() => expect(ensurePagefindUi).toHaveBeenCalledOnce());
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    expect(search.handleSearchEscape(escape)).toBe(true);
    expect(escape.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
    waiting.resolve({});
    await opening;
    expect(document.activeElement).toBe(trigger());
  });

  it("preserves native Escape behavior when search is closed", async () => {
    const search = await import("./search");
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    expect(search.handleSearchEscape(escape)).toBe(false);
    expect(escape.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("does not consume non-Escape keys in an open search dialog", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      cancelable: true,
    });
    expect(search.handleSearchEscape(tab)).toBe(false);
    expect(tab.defaultPrevented).toBe(false);
    expect(dialog().open).toBe(true);
    search.closeSearch();
  });

  it("does not steal focus when a queued focus frame runs after close", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    expect(frames).toHaveLength(1);
    search.closeSearch();
    frames.forEach((frame) => frame(0));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it("restores the explicit opener after a native dialog close", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    frames.forEach((frame) => frame(0));
    dialog().close();
    search.handleSearchClose(eventOn("close", dialog()));
    expect(document.activeElement).toBe(trigger());
  });

  it("recovers focus after native teardown and ignores its queued close event", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    search.closeSearch();
    trigger().blur();
    expect(document.activeElement).toBe(document.body);
    search.handleSearchClose(eventOn("close", dialog()));
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(trigger());
  });

  it("does not let an old close frame steal focus after reopening", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    search.closeSearch();
    const closedFrames = frames.splice(0);
    await search.openSearch(trigger());
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(input());
    closedFrames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(input());
    search.closeSearch();
  });

  it("does not override a different control focused after close", async () => {
    const other = document.createElement("button");
    document.body.prepend(other);
    const search = await import("./search");
    await search.openSearch(trigger());
    search.closeSearch();
    other.focus();
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(other);
  });

  it("does not schedule focus restoration for result navigation", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    frames.splice(0).forEach((frame) => frame(0));
    search.closeSearch({ restoreFocus: false });
    search.handleSearchClose(eventOn("close", dialog()));
    expect(frames).toHaveLength(0);
    expect(document.activeElement).not.toBe(trigger());
  });

  it("cancels a queued close restoration when navigation starts afterward", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    search.closeSearch();
    trigger().blur();
    search.closeSearch({ restoreFocus: false });
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(document.body);
  });

  it("does not take focus back from browser controls after close", async () => {
    const search = await import("./search");
    await search.openSearch(trigger());
    search.closeSearch();
    trigger().blur();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    frames.forEach((frame) => frame(0));
    expect(document.activeElement).toBe(document.body);
  });

  it("ignores stale results after page replacement and close events after reopen", async () => {
    const waiting = deferred();
    ensurePagefindUi.mockReturnValueOnce(waiting.promise);
    const search = await import("./search");
    const opening = search.openSearch();
    await vi.waitFor(() => expect(ensurePagefindUi).toHaveBeenCalledOnce());
    search.closeSearch({ restoreFocus: false });
    document.querySelector("#search")!.innerHTML = '<input type="text">';
    await search.openSearch();
    search.handleSearchClose(eventOn("close", dialog()));
    waiting.resolve({});
    await opening;
    frames.forEach((frame) => frame(0));
    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(document.querySelector<HTMLElement>("#search")!.hidden).toBe(false);
  });

  it("swallows speculative preload failures and retries when explicitly opened", async () => {
    ensurePagefindUi.mockRejectedValueOnce(new Error("offline"));
    const search = await import("./search");
    search.handleSearchPreloadIntent(eventOn("pointerover", trigger()));
    await vi.waitFor(() => expect(ensurePagefindUi).toHaveBeenCalledOnce());
    await search.openSearch();
    expect(ensurePagefindUi).toHaveBeenCalledTimes(2);
    expect(
      document.querySelector<HTMLElement>("#search-load-status")!.hidden,
    ).toBe(true);
    search.closeSearch();
  });
});
