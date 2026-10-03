import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { patchSamsungScroll } from "../../scripts/patch-astro.mjs";

const router = readFileSync(
  new URL(
    "../../node_modules/astro/dist/transitions/router.js",
    import.meta.url,
  ),
  "utf8",
);
const handler = router.match(
  /const onScrollEnd = \(\) => \{[\s\S]*?\n\};/,
)?.[0];

describe("installed Astro Samsung scroll workaround", () => {
  it("is idempotent and rejects incompatible upstream handlers", () => {
    expect(patchSamsungScroll(router)).toBe(router);
    expect(() => patchSamsungScroll("changed upstream code")).toThrow();
  });
  it.each([
    ["Mozilla/5.0 SamsungBrowser/29.0 Chrome/136.0.0.0", false],
    ["Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36", true],
    ["Mozilla/5.0 Version/18.0 Safari/605.1.15", true],
  ])(
    "preserves the scroll handler behavior for %s",
    (userAgent, shouldWrite) => {
      expect(handler).toBeTruthy();
      const updateScrollPosition = vi.fn();
      runInNewContext(`${handler}\nonScrollEnd();`, {
        navigator: { userAgent },
        history: { state: { scrollX: 0, scrollY: 0 } },
        scrollX: 0,
        scrollY: 420,
        updateScrollPosition,
      });
      expect(updateScrollPosition).toHaveBeenCalledTimes(shouldWrite ? 1 : 0);
      if (shouldWrite)
        expect(updateScrollPosition).toHaveBeenCalledWith({
          scrollX: 0,
          scrollY: 420,
        });
    },
  );
});
