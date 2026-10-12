// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const load = vi.fn();
const add = vi.fn();
const remove = vi.fn();
let prepareNavigationFont: typeof import("./navigation-font").prepareNavigationFont;
let commitNavigationFont: typeof import("./navigation-font").commitNavigationFont;
function nextPage() {
  return new DOMParser().parseFromString(
    '<link rel="preload" as="font" href="/next.woff2"><style data-page-font="Next">@font-face{font-family:"Next";src:url("/next.woff2");unicode-range:U+0-7f}</style><style data-page-font-stack>:root{--font-sans:"Next"}</style>',
    "text/html",
  );
}
beforeEach(async () => {
  vi.resetModules();
  ({ prepareNavigationFont, commitNavigationFont } =
    await import("./navigation-font"));
  document.head.innerHTML =
    '<style data-page-font-stack>:root{--font-sans:"Current"}</style>';
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add, delete: remove },
  });
  vi.stubGlobal(
    "FontFace",
    class {
      load = load;
    },
  );
  load.mockReset();
  add.mockClear();
  remove.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps the outgoing page unchanged and commits only the decoded face", async () => {
  load.mockResolvedValue(undefined);
  const next = nextPage();
  const controller = new AbortController();
  await prepareNavigationFont(next, controller.signal);
  expect(document.head.querySelectorAll("style")).toHaveLength(1);
  expect(add).not.toHaveBeenCalled();
  expect(next.querySelector("[data-page-font]")?.textContent).toContain(
    "@font-face",
  );
  commitNavigationFont(next);
  expect(add).toHaveBeenCalledTimes(1);
  expect(next.querySelector("[data-page-font]")?.textContent).toBe("");
  controller.abort();
  expect(remove).not.toHaveBeenCalled();
});
it("drops a decoded face when navigation is superseded before swapping", async () => {
  load.mockResolvedValue(undefined);
  const next = nextPage();
  const controller = new AbortController();
  await prepareNavigationFont(next, controller.signal);
  controller.abort();
  commitNavigationFont(next);
  expect(add).not.toHaveBeenCalled();
  expect(next.querySelector("[data-page-font]")?.textContent).toContain(
    "@font-face",
  );
});
it("cancels pending font preparation without waiting for the server", async () => {
  load.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const pending = prepareNavigationFont(nextPage(), controller.signal);
  controller.abort();
  await pending;
  expect(add).not.toHaveBeenCalled();
});
it("releases the previous JS face when the next page commits", async () => {
  load.mockResolvedValue(undefined);
  for (let i = 0; i < 2; i++) {
    const next = nextPage();
    await prepareNavigationFont(next, new AbortController().signal);
    commitNavigationFont(next);
  }
  expect(add).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledExactlyOnceWith(add.mock.calls[0][0]);
});
it("retains normal CSS loading when preparation fails or times out", async () => {
  load.mockRejectedValueOnce(new Error("offline"));
  const failed = nextPage();
  await prepareNavigationFont(failed, new AbortController().signal);
  commitNavigationFont(failed);
  expect(failed.querySelector("[data-page-font]")?.textContent).toContain(
    "@font-face",
  );
  vi.useFakeTimers();
  load.mockReturnValue(new Promise(() => {}));
  const stalled = nextPage();
  const pending = prepareNavigationFont(stalled, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(2000);
  await pending;
  commitNavigationFont(stalled);
  expect(add).not.toHaveBeenCalled();
  expect(stalled.querySelector("[data-page-font]")?.textContent).toContain(
    "@font-face",
  );
});
