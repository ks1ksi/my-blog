import { expect, test } from "@playwright/test";

type HeaderFrame = {
  y: number;
  height: number;
  opacity: string;
  background: string;
  uiFontReady: boolean;
};
declare global {
  interface Window {
    __headerFrames?: HeaderFrame[];
    __headerDone?: boolean;
    __viewTransitions?: number;
  }
}

test.use({ reducedMotion: "no-preference" });

for (const colorScheme of ["light", "dark"] as const) {
  test(`sticky header is unchanged by scrolled article navigation (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    // Count snapshot transitions even if a browser exposes the API again.
    await page.addInitScript(() => {
      window.__viewTransitions = 0;
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (...args) {
          window.__viewTransitions!++;
          return start.apply(this, args);
        };
    });
    await page.route("https://giscus.app/**", (route) => route.abort());
    // A slow page subset must not change the header while it downloads.
    await page.route("**/seungil-sans-*.woff2", async (route) => {
      if (!route.request().url().includes("seungil-sans-ui-"))
        await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.goto("/blog/");
    await page.locator('[data-year-state-bound="true"]').first().waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
    const header = await page.locator(".site-header").boundingBox();
    const background = await page
      .locator(".site-header")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
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
      document.addEventListener(
        "astro:after-swap",
        () => {
          const frames: HeaderFrame[] = [];
          window.__headerFrames = frames;
          window.__headerDone = false;
          let remaining = 20;
          const sample = () => {
            const element =
              document.querySelector<HTMLElement>(".site-header")!;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            frames.push({
              y: rect.y,
              height: rect.height,
              opacity: style.opacity,
              background: style.backgroundColor,
              uiFontReady: document.fonts.check(
                '650 16px "Seungil Sans UI"',
                "ks1ksi 글 태그",
              ),
            });
            if (--remaining) requestAnimationFrame(sample);
            else window.__headerDone = true;
          };
          // First sample: synchronously after the swap, before any paint.
          sample();
        },
        { once: true },
      );
    });
    await article.click();
    await expect(page).toHaveURL((url) => url.pathname === path);
    await expect
      .poll(() => page.evaluate(() => window.__headerDone))
      .toBe(true);
    expect(await page.evaluate(() => window.__viewTransitions)).toBe(0);
    const frames = await page.evaluate(() => window.__headerFrames!);
    expect(frames).toHaveLength(20);
    for (const frame of frames) {
      expect(frame.opacity, JSON.stringify(frames)).toBe("1");
      expect(frame.background).toBe(background);
      // The header font is shared by every page and stays decoded.
      expect(frame.uiFontReady, JSON.stringify(frames)).toBe(true);
      expect(Math.abs(frame.y - header!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.height - header!.height)).toBeLessThanOrEqual(1);
    }
    // The header is still replaced normally so route and theme controls update.
    await expect(page.locator('.primary-nav a[href="/blog/"]')).toHaveAttribute(
      "aria-current",
      "location",
    );
    await page.locator(".site-brand").click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(
      page.locator('.primary-nav a[href="/blog/"]'),
    ).not.toHaveAttribute("aria-current");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page.locator("#search-dialog")).toBeVisible();
  });
}
