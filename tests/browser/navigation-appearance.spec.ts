import { expect, test } from "@playwright/test";

type EntryFrame = {
  y: number;
  titleY: number;
  titleHeight: number;
  background: string;
  fontReady: boolean;
};

declare global {
  interface Window {
    __articleEntryFrames?: EntryFrame[];
    __articleEntryComplete?: boolean;
  }
}

// Exercise Astro's normal transition, including its animated fallback. The
// default reduced-motion setting in the other tests intentionally skips fades.
test.use({ reducedMotion: "no-preference" });

for (const colorScheme of ["light", "dark"] as const) {
  for (const fallback of [false, true]) {
    test(`scrolled article entry preserves layout and theme (${colorScheme}, ${fallback ? "fallback" : "native"})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(
        ({ theme, forceFallback }) => {
          localStorage.setItem("theme", theme);
          if (forceFallback)
            Object.defineProperty(document, "startViewTransition", {
              value: undefined,
              configurable: true,
            });
        },
        { theme: colorScheme, forceFallback: fallback },
      );
      await page.route("https://giscus.app/**", (route) => route.abort());
      await page.route("**/*.woff2*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.continue();
      });
      await page.goto("/blog/");
      await page.locator('[data-year-state-bound="true"]').first().waitFor();
      const background = await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo(0, 1200);
        return getComputedStyle(document.body).backgroundColor;
      });
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
      // Click a card actually visible in the scrolled viewport. Clicking the
      // first card would scroll the list back up and miss the reported case.
      const index = await page.locator("main h3 a").evaluateAll((links) =>
        links.findIndex((link) => {
          const rect = link.getBoundingClientRect();
          return rect.top > 100 && rect.bottom < innerHeight - 20;
        }),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const article = page.locator("main h3 a").nth(index);
      const path = new URL((await article.getAttribute("href"))!, page.url())
        .pathname;
      await page.evaluate(() => {
        const frames: EntryFrame[] = [];
        window.__articleEntryFrames = frames;
        window.__articleEntryComplete = false;
        document.addEventListener(
          "astro:after-swap",
          () => {
            const family = document.querySelector<HTMLStyleElement>(
              "style[data-page-font]",
            )!.dataset.pageFont!;
            const sample = () => {
              const title = document
                .querySelector("h1")!
                .getBoundingClientRect();
              frames.push({
                y: scrollY,
                titleY: title.y,
                titleHeight: title.height,
                background: getComputedStyle(document.body).backgroundColor,
                fontReady: document.fonts.check(
                  `16px ${JSON.stringify(family)}`,
                  "A",
                ),
              });
            };
            sample();
            let remaining = 30;
            const frame = () => {
              sample();
              if (--remaining) requestAnimationFrame(frame);
              else window.__articleEntryComplete = true;
            };
            requestAnimationFrame(frame);
          },
          { once: true },
        );
      });
      await article.click();
      await expect(page).toHaveURL((url) => url.pathname === path);
      await expect
        .poll(() => page.evaluate(() => window.__articleEntryComplete))
        .toBe(true);
      const frames = await page.evaluate(() => window.__articleEntryFrames!);
      const first = frames[0];
      expect(frames).toHaveLength(31);
      for (const frame of frames) {
        expect(frame.fontReady, JSON.stringify(frames)).toBe(true);
        expect(frame.background).toBe(background);
        expect(Math.abs(frame.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.titleY - first.titleY)).toBeLessThanOrEqual(1);
        expect(
          Math.abs(frame.titleHeight - first.titleHeight),
        ).toBeLessThanOrEqual(1);
      }
      await page.goBack();
      await expect(page).toHaveURL(/\/blog\/$/);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
      await page.goForward();
      await expect(page).toHaveURL((url) => url.pathname === path);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      expect(
        await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
      ).toBe(background);
    });
  }
}
