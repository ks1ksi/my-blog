// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function finishLoad(link: HTMLLinkElement) {
  Object.defineProperty(link, "sheet", { value: {}, configurable: true });
  link.dispatchEvent(new Event("load"));
}

beforeEach(() => {
  vi.resetModules();
  // Keep resource completion deterministic; tests dispatch load/error events.
  vi.spyOn(HTMLLinkElement.prototype, "href", "set").mockImplementation(
    () => {},
  );
  document.head.innerHTML = "";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("lazy search stylesheet lifecycle", () => {
  it("shares a pending load and reuses its connected loaded link", async () => {
    const { ensureStylesheet } = await import("./stylesheet");
    const first = ensureStylesheet("search-css", "/ui.css");
    expect(ensureStylesheet("search-css", "/ui.css")).toBe(first);
    const link = document.querySelector("link")!;
    finishLoad(link);
    await first;
    await ensureStylesheet("search-css", "/ui.css");
    expect(document.querySelectorAll("link")).toHaveLength(1);
  });

  it("restores a resolved stylesheet removed by an Astro head swap", async () => {
    const { ensureStylesheet } = await import("./stylesheet");
    const first = ensureStylesheet("search-css", "/ui.css");
    const oldLink = document.querySelector("link")!;
    finishLoad(oldLink);
    await first;
    oldLink.remove();

    const next = ensureStylesheet("search-css", "/ui.css");
    const newLink = document.querySelector("link")!;
    expect(newLink).not.toBe(oldLink);
    finishLoad(newLink);
    await next;
    expect(newLink.isConnected).toBe(true);
  });

  it("cancels a detached pending load without poisoning its replacement", async () => {
    const { ensureStylesheet } = await import("./stylesheet");
    const first = ensureStylesheet("search-css", "/ui.css");
    const rejected = expect(first).rejects.toThrow("removed during navigation");
    const oldLink = document.querySelector("link")!;
    oldLink.remove();
    const replacement = ensureStylesheet("search-css", "/ui.css");
    const link = document.querySelector("link")!;
    oldLink.dispatchEvent(new Event("error"));
    expect(link.isConnected).toBe(true);
    finishLoad(link);
    await Promise.all([rejected, replacement]);
  });

  it("removes failed links and permits a fresh retry", async () => {
    const { ensureStylesheet } = await import("./stylesheet");
    const failed = ensureStylesheet("search-css", "/ui.css");
    const rejection = expect(failed).rejects.toThrow("Failed to load");
    document.querySelector("link")!.dispatchEvent(new Event("error"));
    await rejection;
    expect(document.querySelector("link")).toBeNull();
    const retry = ensureStylesheet("search-css", "/ui.css");
    finishLoad(document.querySelector("link")!);
    await retry;
  });

  it("bounds a stalled request and permits retry", async () => {
    vi.useFakeTimers();
    const { ensureStylesheet } = await import("./stylesheet");
    const first = ensureStylesheet("search-css", "/ui.css");
    const rejected = expect(first).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    const retry = ensureStylesheet("search-css", "/ui.css");
    finishLoad(document.querySelector("link")!);
    await retry;
  });
});
