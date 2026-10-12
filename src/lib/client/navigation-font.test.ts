// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commitNavigationFont, prepareNavigationFont } from "./navigation-font";

const load = vi.fn();
function nextPage() {
  return new DOMParser().parseFromString(
    '<style data-page-font="Next">@font-face{font-family:"Next";src:url("/next.woff2")}</style><style data-page-font-stack>:root{--font-sans:"Next"}</style>',
    "text/html",
  );
}
beforeEach(() => {
  document.head.innerHTML =
    '<style data-page-font-stack>:root{--font-sans:"Current"}</style>';
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load },
  });
  load.mockReset();
});
afterEach(() => vi.useRealTimers());

it("prepares only the face and retains it after a committed swap", async () => {
  load.mockResolvedValue([{}]);
  const next = nextPage();
  const controller = new AbortController();
  await prepareNavigationFont(next, controller.signal);
  expect(
    document.querySelector("[data-page-font-stack]")?.textContent,
  ).toContain('"Current"');
  expect(document.querySelectorAll("style")).toHaveLength(2);
  commitNavigationFont(next);
  controller.abort();
  expect(document.querySelector("[data-page-font]")).not.toBeNull();
});

it("removes a decoded face if its navigation is superseded before swapping", async () => {
  load.mockResolvedValue([{}]);
  const controller = new AbortController();
  await prepareNavigationFont(nextPage(), controller.signal);
  controller.abort();
  expect(document.querySelector("[data-page-font]")).toBeNull();
});

it("cancels a pending load without waiting for the font server", async () => {
  load.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const pending = prepareNavigationFont(nextPage(), controller.signal);
  controller.abort();
  await pending;
  expect(document.querySelector("[data-page-font]")).toBeNull();
});

it("awaits an existing face without deleting the current page's style on abort", async () => {
  const next = nextPage();
  document.head.append(next.querySelector("[data-page-font]")!.cloneNode(true));
  load.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const pending = prepareNavigationFont(next, controller.signal);
  expect(load).toHaveBeenCalled();
  controller.abort();
  await pending;
  expect(document.querySelectorAll("[data-page-font]")).toHaveLength(1);
});

it("falls back to normal navigation when loading fails or stalls", async () => {
  load.mockRejectedValueOnce(new Error("offline"));
  await prepareNavigationFont(nextPage(), new AbortController().signal);
  expect(document.querySelector("[data-page-font]")).toBeNull();
  vi.useFakeTimers();
  load.mockReturnValue(new Promise(() => {}));
  const pending = prepareNavigationFont(
    nextPage(),
    new AbortController().signal,
  );
  await vi.advanceTimersByTimeAsync(2000);
  await pending;
  expect(document.querySelector("[data-page-font]")).toBeNull();
});
