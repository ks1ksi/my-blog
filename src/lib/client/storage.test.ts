// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.className = "";
  document.body.innerHTML = "";
});
afterEach(() => vi.restoreAllMocks());

function blockStorage() {
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    vi.spyOn(window, kind, "get").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
  }
}

describe("optional UI preference persistence", () => {
  it("falls back to memory when accessing storage itself is blocked", async () => {
    blockStorage();
    const { readPreference, writePreference } = await import("./storage");
    expect(readPreference("local", "theme")).toBeNull();
    writePreference("local", "theme", "dark");
    writePreference("session", "toc", "true");
    expect(readPreference("local", "theme")).toBe("dark");
    expect(readPreference("session", "toc")).toBe("true");
  });

  it("keeps a new preference if a full storage still returns an old value", async () => {
    localStorage.setItem("theme", "light");
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    const { readPreference, writePreference } = await import("./storage");
    expect(readPreference("local", "theme")).toBe("light");
    writePreference("local", "theme", "dark");
    expect(readPreference("local", "theme")).toBe("dark");
  });

  it("applies initial system theme even if localStorage throws", () => {
    const head = readFileSync(
      `${process.cwd()}/src/components/Head.astro`,
      "utf8",
    );
    const script = head.match(/<script is:inline>([\s\S]*?)<\/script>/)![1];
    expect(() =>
      runInNewContext(script, {
        localStorage: {
          getItem() {
            throw new Error("blocked");
          },
        },
        window: { matchMedia: () => ({ matches: true }) },
        document,
      }),
    ).not.toThrow();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps theme controls usable and selected through reinitialization", async () => {
    blockStorage();
    document.body.innerHTML =
      '<button id="theme-toggle"></button><button data-theme-value="dark"></button><button data-theme-value="light"></button><button data-theme-value="system"></button>';
    const { initializeTheme, selectTheme } = await import("./theme");
    initializeTheme();
    const dark = document.querySelector<HTMLButtonElement>(
      '[data-theme-value="dark"]',
    )!;
    selectTheme(dark);
    initializeTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(dark.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement?.id).toBe("theme-toggle");
  });

  it("preserves TOC and year disclosures without sessionStorage", async () => {
    blockStorage();
    document.body.innerHTML =
      '<details data-table-of-contents></details><details data-year-details data-year="2026"></details>';
    const { storeTableOfContentsState, restoreTableOfContentsState } =
      await import("./disclosures");
    const { initBlogIndexState, restoreBlogIndexState } =
      await import("../blog-index-state");
    const toc = document.querySelector<HTMLDetailsElement>(
      "[data-table-of-contents]",
    )!;
    toc.open = true;
    const toggle = new Event("toggle");
    Object.defineProperty(toggle, "target", { value: toc });
    storeTableOfContentsState(toggle);
    initBlogIndexState();
    const year = document.querySelector<HTMLDetailsElement>(
      "[data-year-details]",
    )!;
    year.open = true;
    expect(() => year.dispatchEvent(new Event("toggle"))).not.toThrow();
    const next = document.implementation.createHTMLDocument();
    next.body.innerHTML =
      '<details data-table-of-contents></details><details data-year-details data-year="2026"></details>';
    restoreTableOfContentsState(next);
    restoreBlogIndexState(next);
    expect(
      next.querySelector<HTMLDetailsElement>("[data-table-of-contents]")!.open,
    ).toBe(true);
    expect(
      next.querySelector<HTMLDetailsElement>("[data-year-details]")!.open,
    ).toBe(true);
  });
});
