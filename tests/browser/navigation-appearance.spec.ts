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
    __themeDuringSwap?: string;
  }
}

// Navigation swaps the page in one step without View Transition snapshots.
// Allow motion anyway so a reintroduced animation would be exercised here.
test.use({ reducedMotion: "no-preference" });

for (const colorScheme of ["light", "dark"] as const) {
  test(`scrolled article entry preserves layout and theme (${colorScheme})`, async ({
    page,
  }) => {
    // A stored choice must also win when the device uses the opposite theme.
    await page.emulateMedia({
      colorScheme: colorScheme === "dark" ? "light" : "dark",
    });
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
    }, colorScheme);
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
        "astro:before-swap",
        (event) => {
          const swap = event.swap;
          event.swap = () => {
            swap();
            // Observe before the router restores scroll and fires after-swap.
            window.__themeDuringSwap = getComputedStyle(
              document.querySelector(".site-header")!,
            ).backgroundColor;
          };
        },
        { once: true },
      );
      document.addEventListener(
        "astro:after-swap",
        () => {
          const family = document.querySelector<HTMLStyleElement>(
            "style[data-page-font]",
          )!.dataset.pageFont!;
          const sample = () => {
            const title = document.querySelector("h1")!.getBoundingClientRect();
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
    expect(await page.evaluate(() => window.__themeDuringSwap)).toBe(
      background,
    );
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
