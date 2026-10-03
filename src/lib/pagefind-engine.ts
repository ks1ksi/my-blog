import { createRetryableLoader } from "./client/retryable-loader";

type PagefindEngine = {
  filters: () => Promise<unknown>;
  destroy: () => Promise<void>;
};

async function withDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function createPagefindEngineLoader(
  importEngine: () => Promise<PagefindEngine>,
  timeoutMs = 15000,
  resetTimeoutMs = 1000,
) {
  const loadModule = createRetryableLoader(importEngine, timeoutMs);
  let pending: Promise<PagefindEngine> | undefined;
  let resetFailed = false;
  let pendingReset: Promise<void> | undefined;

  async function resetEngine(engine: PagefindEngine) {
    try {
      await withDeadline(
        engine.destroy(),
        resetTimeoutMs,
        "Search reset timed out",
      );
    } catch (error) {
      resetFailed = true;
      throw error;
    }
  }

  const load = (): Promise<PagefindEngine> => {
    if (resetFailed) {
      return Promise.reject(
        new Error("Search engine reset failed; reload the page"),
      );
    }
    if (pendingReset) return pendingReset.then(load);
    if (pending) return pending;
    pending = (async () => {
      const engine = await loadModule();
      try {
        // Unlike init(), filters() waits for the metadata and WASM backend.
        // Recheck each open: destroying a previous UI resets the shared engine.
        await withDeadline(
          engine.filters(),
          timeoutMs,
          "Search initialization timed out",
        );
      } catch (error) {
        try {
          await resetEngine(engine);
        } catch {
          // An uncertain late reset could destroy a newer attempt. Offer the
          // existing explicit page-refresh action instead of racing that reset.
          resetFailed = true;
        }
        throw error;
      }
      return engine;
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };

  // The default UI's destroy hook does not await engine.destroy(). Finish the
  // shared-engine reset first, then dispose that UI while the engine is empty,
  // and only then allow a new initialization to begin.
  const reset = (dispose?: () => void) => {
    if (pendingReset) return pendingReset;
    const readiness = pending;
    pendingReset = (async () => {
      await readiness?.catch(() => {});
      if (resetFailed)
        throw new Error("Search engine reset failed; reload the page");
      await resetEngine(await loadModule());
      dispose?.();
    })().finally(() => {
      pendingReset = undefined;
    });
    return pendingReset;
  };

  return Object.assign(load, { reset });
}

const bundleUrl = `${import.meta.env.BASE_URL}pagefind/pagefind.js`;

// The default UI exposes no initialization-error callback. Preflight its
// shared engine before mounting so JS, metadata and WASM failures reach our UI.
export const loadPagefindEngine = createPagefindEngineLoader(
  () => import(/* @vite-ignore */ bundleUrl),
);

export const resetPagefindEngine = (dispose: () => void) =>
  loadPagefindEngine.reset(dispose);
