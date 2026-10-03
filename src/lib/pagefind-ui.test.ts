// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
  engine: vi.fn(),
  resetEngine: vi.fn(),
}));
vi.mock("@pagefind/default-ui", () => ({
  PagefindUI: class {
    constructor(options: Record<string, unknown>) {
      spies.create(options);
    }
    destroy() {
      spies.destroy();
    }
  },
}));
vi.mock("./pagefind-engine", () => ({
  loadPagefindEngine: spies.engine,
  resetPagefindEngine: spies.resetEngine,
}));

function finishStyles() {
  const link = document.querySelector<HTMLLinkElement>("#pagefind-ui-styles")!;
  Object.defineProperty(link, "sheet", { value: {}, configurable: true });
  link.dispatchEvent(new Event("load"));
}

beforeEach(() => {
  vi.resetModules();
  // Keep resource completion deterministic; tests dispatch load/error events.
  vi.spyOn(HTMLLinkElement.prototype, "href", "set").mockImplementation(
    () => {},
  );
  vi.clearAllMocks();
  spies.engine.mockResolvedValue({});
  spies.resetEngine.mockImplementation(async (dispose: () => void) =>
    dispose(),
  );
  document.head.innerHTML = "";
  document.body.innerHTML = '<div id="search"></div>';
});

afterEach(() => vi.restoreAllMocks());

describe("Pagefind UI across native navigation", () => {
  it("reuses the persistent UI but restores styles and overrides on re-open", async () => {
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    finishStyles();
    const ui = await first;
    expect(await ensurePagefindUi()).toBe(ui);
    document.head.innerHTML = ""; // Astro replaces dynamic head elements.
    const reopened = ensurePagefindUi();
    finishStyles();
    expect(await reopened).toBe(ui);
    expect(spies.create).toHaveBeenCalledOnce();
    expect(document.querySelector("#pagefind-ui-overrides")).not.toBeNull();
  });

  it("mounts one UI for concurrent pending opens", async () => {
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    const second = ensurePagefindUi();
    finishStyles();
    const [one, two] = await Promise.all([first, second]);
    expect(one).toBe(two);
    expect(spies.create).toHaveBeenCalledOnce();
  });

  it("does not mount an interrupted load into a newer page", async () => {
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    document.body.innerHTML = '<div id="search"></div>';
    finishStyles();
    expect(await first).toBeNull();
    expect(spies.create).not.toHaveBeenCalled();
    expect(await ensurePagefindUi()).not.toBeNull();
    expect(spies.create).toHaveBeenCalledOnce();
  });

  it("replaces the instance when the root really changes", async () => {
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    finishStyles();
    const oldUi = await first;
    document.body.innerHTML = '<div id="search"></div>';
    expect(await ensurePagefindUi()).not.toBe(oldUi);
    expect(spies.destroy).toHaveBeenCalledOnce();
    expect(spies.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      spies.engine.mock.invocationCallOrder[1],
    );
    expect(spies.create).toHaveBeenCalledTimes(2);
  });

  it("awaits asynchronous engine teardown before destroying and replacing the UI", async () => {
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    finishStyles();
    await first;
    let finishReset!: () => void;
    spies.resetEngine.mockImplementationOnce(async (dispose: () => void) => {
      await new Promise<void>((resolve) => {
        finishReset = resolve;
      });
      dispose();
    });
    document.body.innerHTML = '<div id="search"></div>';
    const replacement = ensurePagefindUi();
    const concurrent = ensurePagefindUi();
    expect(spies.destroy).not.toHaveBeenCalled();
    expect(spies.engine).toHaveBeenCalledOnce();
    expect(spies.resetEngine).toHaveBeenCalledOnce();
    finishReset();
    const [one, two] = await Promise.all([replacement, concurrent]);
    expect(one).toBe(two);
    expect(spies.destroy).toHaveBeenCalledOnce();
    expect(spies.create).toHaveBeenCalledTimes(2);
  });

  it("does not mount after an engine failure and permits a later retry", async () => {
    spies.engine.mockRejectedValueOnce(new Error("offline"));
    const { ensurePagefindUi } = await import("./pagefind-ui");
    const first = ensurePagefindUi();
    finishStyles();
    await expect(first).rejects.toThrow("offline");
    expect(spies.create).not.toHaveBeenCalled();
    expect(await ensurePagefindUi()).not.toBeNull();
  });
});
