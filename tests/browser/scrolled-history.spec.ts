import { expect, test } from "@playwright/test";

type Frame = { y: number; height: number; fontReady: boolean };
declare global {
  interface Window {
    __historyFrames?: Frame[];
  }
}
test.use({ reducedMotion: "no-preference" });

for (const fallback of [false, true]) {
  test(`scrolled Back is stable from its first frame (${fallback ? "fallback" : "native"})`, async ({
    page,
  }) => {
    await page.addInitScript((force) => {
      if (force)
        Object.defineProperty(document, "startViewTransition", {
          configurable: true,
          value: undefined,
        });
    }, fallback);
    await page.route("https://giscus.app/**", (route) => route.abort());
    // Exercise decoded-font readiness, including a slow network and an empty
    // HTTP cache. Merely preloading the WOFF2 bytes is not sufficient.
    await page.route("**/*.woff2*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.continue();
    });
    await page.goto("/blog/");
    await page.locator('[data-year-state-bound="true"]').first().waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page
      .locator(".site-brand")
      .evaluate((a) => (a as HTMLAnchorElement).click());
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.evaluate(() => {
      const frames: Frame[] = [];
      window.__historyFrames = frames;
      document.addEventListener(
        "astro:after-swap",
        () => {
          const family = document.querySelector<HTMLStyleElement>(
            "style[data-page-font]",
          )!.dataset.pageFont!;
          const sample = () =>
            frames.push({
              y: scrollY,
              height: document.body.scrollHeight,
              fontReady: document.fonts.check(
                `16px ${JSON.stringify(family)}`,
                "A",
              ),
            });
          // Check at the swap itself, before native View Transitions can capture
          // a snapshot with fallback text; then check actual rendered frames.
          sample();
          let remaining = 20;
          const frame = () => {
            sample();
            if (--remaining) requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        },
        { once: true },
      );
    });
    await page.goBack();
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect
      .poll(() => page.evaluate(() => window.__historyFrames?.length))
      .toBe(21);
    const frames = await page.evaluate(() => window.__historyFrames!);
    expect(
      frames.every((frame) => frame.fontReady),
      JSON.stringify(frames),
    ).toBe(true);
    expect(
      frames.every((frame) => Math.abs(frame.y - 1200) <= 1),
      JSON.stringify(frames),
    ).toBe(true);
    expect(
      frames.every((frame) => Math.abs(frame.height - height) <= 1),
      JSON.stringify(frames),
    ).toBe(true);
  });
}
