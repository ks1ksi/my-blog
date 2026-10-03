import { afterEach, describe, expect, it, vi } from "vitest";
import { createPagefindEngineLoader } from "./pagefind-engine";

afterEach(() => vi.useRealTimers());

function engine() {
  return {
    filters: vi.fn().mockResolvedValue({}),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Pagefind engine readiness", () => {
  it("shares pending readiness but checks the current engine on later opens", async () => {
    const api = engine();
    const importEngine = vi.fn().mockResolvedValue(api);
    const load = createPagefindEngineLoader(importEngine);
    const first = load();
    expect(load()).toBe(first);
    expect(await first).toBe(api);
    await load();
    expect(importEngine).toHaveBeenCalledOnce();
    expect(api.filters).toHaveBeenCalledTimes(2);
    expect(api.destroy).not.toHaveBeenCalled();
  });

  it("surfaces metadata/WASM initialization rejection, resets, and retries", async () => {
    const api = engine();
    api.filters.mockRejectedValueOnce(new Error("WASM unavailable"));
    const load = createPagefindEngineLoader(async () => api);
    await expect(load()).rejects.toThrow("WASM unavailable");
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(await load()).toBe(api);
    expect(api.filters).toHaveBeenCalledTimes(2);
  });

  it("does not start a new initialization before reset finishes", async () => {
    const api = engine();
    let reset!: () => void;
    api.filters.mockRejectedValueOnce(new Error("metadata unavailable"));
    api.destroy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          reset = resolve;
        }),
    );
    const load = createPagefindEngineLoader(async () => api);
    const first = load();
    const rejected = expect(first).rejects.toThrow("metadata unavailable");
    await vi.waitFor(() => expect(api.destroy).toHaveBeenCalledOnce());
    expect(load()).toBe(first);
    expect(api.filters).toHaveBeenCalledOnce();
    reset();
    await rejected;
    await load();
    expect(api.filters).toHaveBeenCalledTimes(2);
  });

  it("times out stalled initialization, resets it, and allows retry", async () => {
    vi.useFakeTimers();
    const api = engine();
    api.filters.mockImplementationOnce(() => new Promise(() => {}));
    const load = createPagefindEngineLoader(async () => api, 100, 10);
    const rejected = expect(load()).rejects.toThrow("initialization timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(await load()).toBe(api);
  });

  it("requires refresh when reset cannot complete, avoiding a late-reset race", async () => {
    vi.useFakeTimers();
    const api = engine();
    api.filters.mockRejectedValueOnce(new Error("metadata unavailable"));
    api.destroy.mockImplementationOnce(() => new Promise(() => {}));
    const load = createPagefindEngineLoader(async () => api, 100, 10);
    const rejected = expect(load()).rejects.toThrow("metadata unavailable");
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    await expect(load()).rejects.toThrow("reload the page");
    expect(api.filters).toHaveBeenCalledOnce();
  });

  it("finishes async reset and UI disposal before any new readiness check", async () => {
    let active = false;
    const completions: (() => void)[] = [];
    const api = {
      filters: vi.fn(async () => {
        active = true;
        return {};
      }),
      destroy: vi.fn(() => {
        if (!active) return Promise.resolve();
        return new Promise<void>((resolve) => {
          completions.push(() => {
            active = false;
            resolve();
          });
        });
      }),
    };
    const load = createPagefindEngineLoader(async () => api);
    await load();
    // Model Svelte's onDestroy hook: it calls destroy but does not await it.
    const dispose = vi.fn(() => {
      void api.destroy();
    });
    const resetting = load.reset(dispose);
    const next = load();
    await vi.waitFor(() => expect(completions).toHaveLength(1));
    expect(api.filters).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();
    completions[0]();
    await resetting;
    expect(await next).toBe(api);
    expect(dispose).toHaveBeenCalledOnce();
    expect(completions).toHaveLength(1); // The UI hook had no live engine to reset.
    expect(active).toBe(true);
    expect(api.filters).toHaveBeenCalledTimes(2);
  });

  it("waits for active readiness before resetting without deadlocking a new open", async () => {
    const api = engine();
    let ready!: (value: object) => void;
    api.filters.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          ready = resolve;
        }),
    );
    const load = createPagefindEngineLoader(async () => api);
    const opening = load();
    await vi.waitFor(() => expect(api.filters).toHaveBeenCalledOnce());
    const resetting = load.reset();
    const reopened = load();
    expect(api.destroy).not.toHaveBeenCalled();
    ready({});
    await Promise.all([opening, resetting, reopened]);
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(api.filters).toHaveBeenCalledTimes(2);
  });

  it("retries an import failure without trying to destroy an absent engine", async () => {
    const api = engine();
    const importEngine = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(api);
    const load = createPagefindEngineLoader(importEngine);
    await expect(load()).rejects.toThrow("offline");
    expect(api.destroy).not.toHaveBeenCalled();
    expect(await load()).toBe(api);
    expect(importEngine).toHaveBeenCalledTimes(2);
  });
});
