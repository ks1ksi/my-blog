import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Keep this deliberately narrow: upstream changes require a fresh review.
export function patchSamsungScroll(source) {
  const anchor = "const onScrollEnd = () => {\n";
  const patched = `${anchor}  if (/\\bSamsungBrowser\\//i.test(navigator.userAgent)) return;\n`;
  if (source.includes(patched)) return source;
  if (source.split(anchor).length !== 2) {
    throw new Error(
      "Astro scroll handler changed. Review the Samsung Internet workaround.",
    );
  }
  return source.replace(anchor, patched);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageUrl = new URL(
    "../node_modules/astro/package.json",
    import.meta.url,
  );
  const { version } = JSON.parse(readFileSync(packageUrl, "utf8"));
  if (version !== "7.3.5")
    throw new Error(`Review the Samsung patch for Astro ${version}.`);
  const routerUrl = new URL(
    "../node_modules/astro/dist/transitions/router.js",
    import.meta.url,
  );
  writeFileSync(routerUrl, patchSamsungScroll(readFileSync(routerUrl, "utf8")));
  console.log(
    `Applied Samsung Internet scroll workaround to Astro ${version}.`,
  );
}
