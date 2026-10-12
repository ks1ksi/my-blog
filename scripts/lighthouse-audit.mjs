import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const origin = process.env.AUDIT_ORIGIN ?? "https://ks1ksi.io";
const expected = process.env.AUDIT_COMMIT;
const outputDir = "lighthouse-reports";

async function identity() {
  const response = await fetch(
    `${origin}/build-info.json?audit=${Date.now()}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Build identity returned ${response.status}`);
  const data = await response.json();
  if (expected && (data.commit !== expected || data.dirty))
    throw new Error(
      "Measured deployment does not match the requested clean commit",
    );
  return data;
}

const build = await identity();
mkdirSync(outputDir, { recursive: true });
const results = [];
for (const [page, path] of [
  ["home", "/"],
  ["article", "/blog/2024---2025-회고/"],
]) {
  for (const device of ["mobile", "desktop"]) {
    for (let run = 1; run <= (device === "mobile" ? 3 : 1); run++) {
      const output = `${outputDir}/${page}-${device}-${run}.json`;
      execFileSync(
        "npx",
        [
          "--yes",
          "lighthouse@13.5.0",
          new URL(path, origin).href,
          "--chrome-flags=--headless --no-sandbox",
          "--quiet",
          "--only-categories=performance,accessibility,best-practices,seo",
          "--output=json",
          `--output-path=${output}`,
          ...(device === "desktop" ? ["--preset=desktop"] : []),
        ],
        { stdio: "inherit", timeout: 150_000 },
      );
      const report = JSON.parse(readFileSync(output, "utf8"));
      if (report.runtimeError)
        throw new Error(JSON.stringify(report.runtimeError));
      const result = {
        page,
        device,
        run,
        url: report.finalDisplayedUrl,
        version: report.lighthouseVersion,
        fetchTime: report.fetchTime,
        scores: Object.fromEntries(
          Object.entries(report.categories).map(([name, category]) => [
            name,
            Math.round(category.score * 100),
          ]),
        ),
        metrics: Object.fromEntries(
          [
            "first-contentful-paint",
            "largest-contentful-paint",
            "speed-index",
            "total-blocking-time",
            "cumulative-layout-shift",
          ].map((name) => [name, report.audits[name].numericValue]),
        ),
      };
      results.push(result);
      console.log("LIGHTHOUSE_RESULT", JSON.stringify(result));
    }
  }
}
const finalBuild = await identity();
if (JSON.stringify(finalBuild) !== JSON.stringify(build))
  throw new Error("Deployment changed during measurement");
writeFileSync(
  `${outputDir}/summary.json`,
  JSON.stringify({ build, results }, null, 2),
);
