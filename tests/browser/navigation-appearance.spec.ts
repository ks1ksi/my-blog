import { expect, test } from "@playwright/test";

interface NavigationProbe {
  swaps: number;
  completed: number;
  frames: number;
  violations: string[];
}

declare global {
  interface Window {
    __navigationAppearance?: NavigationProbe;
  }
}

// The rest of the suite uses reduced motion, which hides page fades.
test.use({ reducedMotion: "no-preference", colorScheme: "dark" });

for (const forceFallback of [false, true]) {
  test(`article navigation and history stay opaque (${forceFallback ? "fallback" : "native when supported"})`, async ({
    page,
  }) => {
    await page.addInitScript((fallback) => {
      localStorage.setItem("theme", "dark");
      if (fallback) {
        Object.defineProperty(document, "startViewTransition", {
          value: undefined,
          configurable: true,
        });
      }
    }, forceFallback);
    await page.goto("/blog/");
    await page.locator('[data-year-state-bound="true"]').first().waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      const background = getComputedStyle(document.body).backgroundColor;
      const probe: NavigationProbe = {
        swaps: 0,
        completed: 0,
        frames: 0,
        violations: [],
      };
      window.__navigationAppearance = probe;
      let active = false;
      const report = (message: string) => {
        if (!probe.violations.includes(message)) probe.violations.push(message);
      };
      const sample = () => {
        probe.frames++;
        for (const element of [document.documentElement, document.body]) {
          if (Number(getComputedStyle(element).opacity) < 1)
            report(`${element.tagName} became transparent`);
        }
        if (getComputedStyle(document.body).backgroundColor !== background)
          report("page background changed during navigation");
        for (const animation of document.getAnimations()) {
          const effect = animation.effect;
          if (!(effect instanceof KeyframeEffect)) continue;
          if (
            effect.target !== document.documentElement &&
            effect.target !== document.body
          )
            continue;
          if (effect.pseudoElement && !effect.pseudoElement.endsWith("(root)"))
            continue;
          if (effect.getKeyframes().some((frame) => Number(frame.opacity) < 1))
            report("whole-page opacity animation");
        }
      };
      const frame = () => {
        sample();
        if (active) requestAnimationFrame(frame);
      };
      document.addEventListener("astro:before-preparation", () => {
        if (!active) {
          active = true;
          requestAnimationFrame(frame);
        }
      });
      document.addEventListener("astro:after-swap", () => {
        probe.swaps++;
        sample();
      });
      document.addEventListener("astro:page-load", () => {
        if (!active) return;
        // Native transition animations can start after the DOM swap and
        // page-load event. Keep sampling through the next rendered frames.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            sample();
            active = false;
            probe.completed++;
          });
        });
      });
    });

    const article = page.locator("main h3 a").first();
    const articlePath = new URL(
      (await article.getAttribute("href"))!,
      page.url(),
    ).pathname;
    await article.click();
    await expect(page).toHaveURL((url) => url.pathname === articlePath);
    await expect
      .poll(() => page.evaluate(() => window.__navigationAppearance?.completed))
      .toBe(1);
    await page.goBack();
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect
      .poll(() => page.evaluate(() => window.__navigationAppearance?.completed))
      .toBe(2);
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === articlePath);
    await expect
      .poll(() => page.evaluate(() => window.__navigationAppearance?.completed))
      .toBe(3);
    const probe = await page.evaluate(() => window.__navigationAppearance!);
    expect(probe.swaps).toBe(3);
    expect(probe.frames).toBeGreaterThan(0);
    expect(probe.violations).toEqual([]);
  });
}
