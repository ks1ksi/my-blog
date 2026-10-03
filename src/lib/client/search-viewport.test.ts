// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackSearchViewport } from "./search-viewport";

let dialog: HTMLDialogElement;
let viewport: EventTarget & { height: number; offsetTop: number };
let stop: () => void;

beforeEach(() => {
  dialog = document.createElement("dialog");
  document.body.append(dialog);
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  stop = () => {};
});

afterEach(() => {
  stop();
  dialog.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("open search visual viewport", () => {
  it("tracks keyboard resizing and viewport panning without moving focus", () => {
    const focus = document.activeElement;
    stop = trackSearchViewport(dialog);
    expect(dialog.style.getPropertyValue("--search-viewport-height")).toBe(
      "800px",
    );
    viewport.height = 310;
    viewport.offsetTop = 120;
    viewport.dispatchEvent(new Event("resize"));
    expect(dialog.style.getPropertyValue("--search-viewport-height")).toBe(
      "310px",
    );
    expect(dialog.style.getPropertyValue("--search-viewport-top")).toBe(
      "120px",
    );
    viewport.offsetTop = 160;
    viewport.dispatchEvent(new Event("scroll"));
    expect(dialog.style.getPropertyValue("--search-viewport-top")).toBe(
      "160px",
    );
    expect(document.activeElement).toBe(focus);
  });

  it("removes listeners and stale dimensions when closed, then resubscribes", () => {
    const add = vi.spyOn(viewport, "addEventListener");
    const remove = vi.spyOn(viewport, "removeEventListener");
    stop = trackSearchViewport(dialog);
    expect(add).toHaveBeenCalledTimes(2);
    stop();
    expect(remove).toHaveBeenCalledWith("resize", add.mock.calls[0][1]);
    expect(remove).toHaveBeenCalledWith("scroll", add.mock.calls[1][1]);
    viewport.height = 280;
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
    expect(dialog.style.cssText).toBe("");
    stop = trackSearchViewport(dialog);
    expect(dialog.style.getPropertyValue("--search-viewport-height")).toBe(
      "280px",
    );
  });

  it("clamps negative overscroll offsets and leaves the dvh fallback alone", () => {
    viewport.offsetTop = -20;
    stop = trackSearchViewport(dialog);
    expect(dialog.style.getPropertyValue("--search-viewport-top")).toBe("0px");
    stop();
    vi.stubGlobal("visualViewport", null);
    stop = trackSearchViewport(dialog);
    expect(dialog.style.cssText).toBe("");
    expect(() => stop()).not.toThrow();
  });
});
