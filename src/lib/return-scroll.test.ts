import { beforeEach, describe, expect, it } from "vitest";
import {
  rememberNavigationSource,
  restoreReturnScrollPosition,
} from "./return-scroll";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

function setWindow(pathname: string, scrollY: number, scrolls: number[] = []) {
  globalThis.window = {
    location: { pathname },
    scrollY,
    scrollTo: (_x: number, y: number) => {
      scrolls.push(y);
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
    setTimeout: (callback: () => void) => {
      callback();
      return 0;
    },
  } as Window & typeof globalThis;
}

function navigationEvent(from: string, to: string) {
  const event = new Event("astro:before-preparation");
  Object.defineProperties(event, {
    from: { value: new URL(from, "https://ks1ksi.io") },
    to: { value: new URL(to, "https://ks1ksi.io") },
  });

  return event;
}

describe("return-scroll", () => {
  beforeEach(() => {
    globalThis.sessionStorage = new MemoryStorage() as Storage;
  });

  it("restores a list page scroll position once after returning from a post", () => {
    setWindow("/blog", 480);
    rememberNavigationSource(navigationEvent("/blog", "/blog/example"));

    const scrolls: number[] = [];
    setWindow("/blog", 0, scrolls);

    expect(restoreReturnScrollPosition()).toBe(true);
    expect(scrolls).toContain(480);
    expect(sessionStorage.getItem("return-scroll:intent")).toBeNull();
    expect(restoreReturnScrollPosition()).toBe(false);
  });

  it("does not restore when the current route does not match the intent", () => {
    setWindow("/blog", 320);
    rememberNavigationSource(navigationEvent("/blog", "/blog/example"));

    const scrolls: number[] = [];
    setWindow("/tags", 0, scrolls);

    expect(restoreReturnScrollPosition()).toBe(false);
    expect(scrolls).toEqual([]);
  });
});
