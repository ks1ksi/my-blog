import { chromium, devices } from "@playwright/test";
import sharp from "sharp";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.AUDIT_ORIGIN || "http://127.0.0.1:4321";
const expected = process.env.AUDIT_COMMIT;
const out = "render-audit";
await mkdir(out, { recursive: true });
let response;
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    response = await fetch(`${origin}/build-info.json?audit=${Date.now()}`);
    if (response.ok) break;
  } catch {}
  await setTimeout(200);
}
if (!response?.ok) throw new Error("Preview did not become ready");
const identity = await response.json();
console.log("BUILD_IDENTITY", JSON.stringify(identity));
if (expected && identity.commit !== expected)
  throw new Error("Unexpected build");
const browser = await chromium.launch();
const summaries = [];
for (const route of ["/", "/blog/"])
  for (const native of [true, false])
    for (const colorScheme of ["light", "dark"]) {
      const name = `${route === "/" ? "home" : "archive"}-${native ? "native" : "fallback"}-${colorScheme}`;
      const context = await browser.newContext({
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        colorScheme,
        reducedMotion: "no-preference",
      });
      if (!native)
        await context.addInitScript(() => {
          document.startViewTransition = undefined;
        });
      const page = await context.newPage();
      await page.goto(`${origin}${route}`);
      if (route === "/blog/")
        await page.locator('[data-year-state-bound="true"]').first().waitFor();
      const y = route === "/" ? 400 : 1200;
      await page.evaluate(async (y) => {
        await document.fonts.ready;
        scrollTo(0, y);
      }, y);
      await page.waitForFunction((y) => scrollY === y, y);
      const header = await page.locator(".site-header").boundingBox();
      const index = await page.locator("main h3 a").evaluateAll((links) =>
        links.findIndex((link) => {
          const r = link.getBoundingClientRect();
          return r.top > 110 && r.bottom < innerHeight - 20;
        }),
      );
      if (index < 0) throw new Error("No visible link");
      const article = page.locator("main h3 a").nth(index);
      const target = new URL(await article.getAttribute("href"), origin).href;
      const before = await page.screenshot();
      const frames = [];
      const cdp = await context.newCDPSession(page);
      cdp.on("Page.screencastFrame", (event) => {
        frames.push({
          data: Buffer.from(event.data, "base64"),
          metadata: event.metadata,
        });
        void cdp.send("Page.screencastFrameAck", {
          sessionId: event.sessionId,
        });
      });
      await page.evaluate(() => {
        window.__renderSamples = [];
        window.__swapState = null;
        document.addEventListener(
          "astro:before-swap",
          (event) => {
            const swap = event.swap;
            event.swap = () => {
              const before = getComputedStyle(
                document.querySelector(".site-header"),
              ).backgroundColor;
              swap();
              window.__swapState = {
                before,
                immediate: getComputedStyle(
                  document.querySelector(".site-header"),
                ).backgroundColor,
                dark: document.documentElement.classList.contains("dark"),
              };
            };
          },
          { once: true },
        );
        const begin = performance.now();
        const sample = () => {
          const h = document.querySelector(".site-header");
          const brand = document.querySelector(".site-brand");
          const rect = h.getBoundingClientRect();
          const root = getComputedStyle(document.documentElement);
          window.__renderSamples.push({
            time: performance.timeOrigin + performance.now(),
            elapsed: performance.now() - begin,
            path: location.pathname,
            scroll: scrollY,
            headerY: rect.y,
            rootOpacity: root.opacity,
            headerOpacity: getComputedStyle(h).opacity,
            headerBackground: getComputedStyle(h).backgroundColor,
            brandFont: getComputedStyle(brand).fontFamily,
            phase: document.documentElement.getAttribute(
              "data-astro-transition-fallback",
            ),
            group: getComputedStyle(
              document.documentElement,
              "::view-transition-group(site-header)",
            ).transform,
            oldOpacity: getComputedStyle(
              document.documentElement,
              "::view-transition-old(site-header)",
            ).opacity,
            newOpacity: getComputedStyle(
              document.documentElement,
              "::view-transition-new(site-header)",
            ).opacity,
          });
          if (performance.now() - begin < 3500) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await cdp.send("Page.startScreencast", {
        format: "png",
        maxWidth: 412,
        maxHeight: 839,
        everyNthFrame: 1,
      });
      await article.tap();
      await page.waitForURL(target);
      await page.waitForTimeout(1300);
      await cdp.send("Page.stopScreencast");
      const after = await page.screenshot();
      const crop = {
        left: 0,
        top: 0,
        width: 190,
        height: Math.round(header.height) - 1,
      };
      const baseline = await sharp(before)
        .extract(crop)
        .removeAlpha()
        .raw()
        .toBuffer();
      let maxMeanDiff = 0,
        minInk = Infinity;
      const details = [];
      const tiles = [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const pixel = await sharp(frame.data)
          .extract(crop)
          .removeAlpha()
          .raw()
          .toBuffer();
        let sum = 0,
          ink = 0;
        const bg = colorScheme === "light" ? [247, 246, 242] : [19, 28, 25];
        for (let j = 0; j < pixel.length; j++) {
          sum += Math.abs(pixel[j] - baseline[j]);
          if (Math.abs(pixel[j] - bg[j % 3]) > 40) ink++;
        }
        const meanDiff = sum / pixel.length;
        maxMeanDiff = Math.max(maxMeanDiff, meanDiff);
        minInk = Math.min(minInk, ink);
        details.push({
          index: i,
          time: frame.metadata.timestamp,
          meanDiff,
          ink,
        });
        // The filmstrip preserves every captured header frame without storing full pages.
        const strip = await sharp(frame.data)
          .extract({
            left: 0,
            top: 0,
            width: 412,
            height: Math.round(header.height),
          })
          .png()
          .toBuffer();
        tiles.push({
          input: strip,
          left: 0,
          top: i * (Math.round(header.height) + 4),
        });
      }
      await sharp({
        create: {
          width: 412,
          height: Math.max(1, frames.length) * (Math.round(header.height) + 4),
          channels: 3,
          background: "#888",
        },
      })
        .composite(tiles)
        .png()
        .toFile(`${out}/${name}-filmstrip.png`);
      await writeFile(`${out}/${name}-before.png`, before);
      await writeFile(`${out}/${name}-after.png`, after);
      await writeFile(
        `${out}/${name}.json`,
        JSON.stringify(
          {
            identity,
            header,
            details,
            swap: await page.evaluate(() => window.__swapState),
            samples: await page.evaluate(() => window.__renderSamples),
          },
          null,
          2,
        ),
      );
      const summary = {
        name,
        frames: frames.length,
        maxMeanDiff,
        minInk,
        header,
        swap: await page.evaluate(() => window.__swapState),
      };
      summaries.push(summary);
      console.log("RENDER_AUDIT", JSON.stringify(summary));
      await context.close();
    }
await browser.close();
await writeFile(`${out}/summary.json`, JSON.stringify(summaries, null, 2));

for (const summary of summaries) {
  assert(summary.frames >= 3, `${summary.name}: insufficient rendered frames`);
  assert(
    summary.maxMeanDiff <= 0.5,
    `${summary.name}: header pixels changed (${summary.maxMeanDiff})`,
  );
  assert.equal(
    summary.swap.immediate,
    summary.swap.before,
    `${summary.name}: theme changed during the swap`,
  );
}
