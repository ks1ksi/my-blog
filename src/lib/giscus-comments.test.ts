// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGiscusComments } from "./giscus-comments";

registerGiscusComments();

function createComments() {
  const element = document.createElement("giscus-comments");
  element.innerHTML = `<details><summary>댓글</summary><p class="comments-status" role="status"></p><button class="comments-retry" hidden>다시 시도</button><div class="giscus"></div></details><template><script type="application/x-unit-test" src="https://giscus.app/client.js"></script></template>`;
  document.body.append(element);
  return element;
}

function open(element: HTMLElement) {
  const details = element.querySelector("details")!;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.classList.remove("dark");
  vi.useRealTimers();
});

describe("deferred comments recovery", () => {
  it("defers the request, uses current theme, and does not duplicate an in-flight load", () => {
    document.documentElement.classList.add("dark");
    const element = createComments();
    expect(element.querySelector("script")).toBeNull();
    open(element);
    open(element);
    expect(element.querySelectorAll("script")).toHaveLength(1);
    expect(element.querySelector("script")?.dataset.theme).toBe("dark");
    expect(element.getAttribute("aria-busy")).toBe("true");
  });

  it("offers an immediate retry after failure and waits for the replacement frame", async () => {
    const element = createComments();
    open(element);
    const oldScript = element.querySelector("script")!;
    oldScript.dispatchEvent(new Event("error"));
    const retry = element.querySelector<HTMLButtonElement>(".comments-retry")!;
    expect(retry.hidden).toBe(false);
    retry.click();
    expect(element.querySelector("script")).not.toBe(oldScript);
    expect(retry.hidden).toBe(true);
    oldScript.dispatchEvent(new Event("error"));
    expect(element.getAttribute("aria-busy")).toBe("true");
    const frame = document.createElement("iframe");
    element.querySelector(".giscus")!.append(frame);
    element.querySelector("script")!.dispatchEvent(new Event("load"));
    frame.dispatchEvent(new Event("load"));
    expect(element.getAttribute("aria-busy")).toBe("false");
    expect(element.querySelector(".comments-status")?.textContent).toBe("");
  });

  it("allows collapse/reopen retry and recovers from a stalled load", () => {
    const element = createComments();
    open(element);
    vi.advanceTimersByTime(15_000);
    expect(
      element.querySelector<HTMLButtonElement>(".comments-retry")!.hidden,
    ).toBe(false);
    element.querySelector("details")!.open = false;
    open(element);
    expect(element.querySelector("script")).not.toBeNull();
    expect(element.getAttribute("aria-busy")).toBe("true");
  });

  it("ignores disconnected events and can reconnect without stale pending state", () => {
    const element = createComments();
    open(element);
    const oldScript = element.querySelector("script")!;
    element.remove();
    document.body.append(element);
    const newScript = element.querySelector("script");
    expect(newScript).not.toBeNull();
    expect(newScript).not.toBe(oldScript);
    oldScript.dispatchEvent(new Event("error"));
    expect(element.querySelector("script")).toBe(newScript);
    expect(
      element.querySelector<HTMLButtonElement>(".comments-retry")!.hidden,
    ).toBe(true);
  });
});
