import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../components/ScrollRestoration.astro", import.meta.url),
  "utf8",
);
const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)![1];
const key = "blog:reload-scroll";
const href = "https://example.test/blog/";

function documentContext(
  storage = new Map<string, string>(),
  { type = "reload", url = href, index = 2, denyStorage = false } = {},
) {
  const handlers = new Map<string, () => void>();
  const history = {
    state: { index, scrollX: 0, scrollY: 1147, custom: "keep" },
    replaceState: vi.fn((state) => {
      history.state = state;
    }),
  };
  const context = {
    window: {
      scrollX: 0,
      scrollY: 0,
      addEventListener: vi.fn((name, handler) => handlers.set(name, handler)),
    },
    history,
    location: { href: url },
    performance: { getEntriesByType: () => [{ type }] },
    sessionStorage: {
      getItem: (name: string) => {
        if (denyStorage) throw new Error("Storage denied");
        return storage.get(name) ?? null;
      },
      setItem: (name: string, value: string) => {
        if (denyStorage) throw new Error("Storage denied");
        storage.set(name, value);
      },
      removeItem: (name: string) => storage.delete(name),
    },
  };
  const run = () => runInNewContext(script, context);
  return { context, handlers, history, run };
}

describe("reload scroll bootstrap", () => {
  it.each([0, 480])(
    "carries position %i even when Chromium reloads its earlier history snapshot",
    (y) => {
      const storage = new Map<string, string>();
      const outgoing = documentContext(storage, { type: "navigate" });
      outgoing.run();
      outgoing.context.window.scrollY = y;
      outgoing.handlers.get("pagehide")!();

      // Chromium can retain the OLD history snapshot despite replaceState
      // in pagehide. The new document must repair that snapshot before Astro.
      const incoming = documentContext(storage);
      expect(incoming.history.state.scrollY).toBe(1147);
      incoming.run();
      expect(incoming.history.state).toEqual({
        index: 2,
        scrollX: 0,
        scrollY: y,
        custom: "keep",
      });
      expect(storage.has(key)).toBe(false);
    },
  );

  it.each([
    { type: "back_forward" },
    { type: "navigate" },
    { url: `${href}?other=1` },
    { url: `${href}#other` },
    { index: 3 },
  ])(
    "does not replay a snapshot onto a different navigation: %o",
    (options) => {
      const storage = new Map([
        [key, JSON.stringify({ href, index: 2, scrollX: 0, scrollY: 480 })],
      ]);
      const page = documentContext(storage, options);
      page.run();
      expect(page.history.replaceState).not.toHaveBeenCalled();
      expect(storage.has(key)).toBe(false);
    },
  );

  it("registers only once when its inline script is seen during a DOM swap", () => {
    const page = documentContext();
    page.run();
    page.run();
    expect(page.context.window.addEventListener).toHaveBeenCalledTimes(1);
  });

  it("clamps mobile overscroll to zero", () => {
    const storage = new Map<string, string>();
    const outgoing = documentContext(storage);
    outgoing.run();
    outgoing.context.window.scrollY = -80;
    outgoing.handlers.get("pagehide")!();
    const incoming = documentContext(storage);
    incoming.run();
    expect(incoming.history.state.scrollY).toBe(0);
  });

  it.each([
    "broken json",
    "null",
    '{"href":"https://example.test/blog/","index":2,"scrollY":"480"}',
  ])("ignores malformed snapshots: %s", (value) => {
    const page = documentContext(new Map([[key, value]]));
    expect(page.run).not.toThrow();
    expect(page.history.replaceState).not.toHaveBeenCalled();
  });

  it("keeps navigation usable when session storage is denied", () => {
    const page = documentContext(undefined, { denyStorage: true });
    expect(page.run).not.toThrow();
    expect(() => page.handlers.get("pagehide")!()).not.toThrow();
  });
});
