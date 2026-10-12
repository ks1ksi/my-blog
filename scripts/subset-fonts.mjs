import {
  readFile,
  readdir,
  writeFile,
  copyFile,
  mkdir,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import subsetFont from "subset-font";
import fontverter from "fontverter";
import { readFontCache, writeFontCache } from "./font-cache.mjs";
import {
  headerCharacters,
  pageCharacters,
  renameFont,
  subsetMarkup,
  uiFontMarkup,
} from "./font-subset-utils.mjs";

const root = resolve(process.argv[2] ?? "dist");
const require = createRequire(import.meta.url);
const packageRoot = resolve(require.resolve("pretendard/package.json"), "..");
const source = await readFile(
  join(packageRoot, "dist/web/variable/woff2/PretendardVariable.woff2"),
);
const { font, nameIds } = renameFont(await fontverter.convert(source, "sfnt"));
const sourceHash = createHash("sha256")
  .update(font)
  .update(await readFile(new URL("./font-subset-utils.mjs", import.meta.url)))
  .update(await readFile(new URL("./subset-fonts.mjs", import.meta.url)))
  .update(await readFile(new URL("./font-cache.mjs", import.meta.url)))
  .update(await readFile(new URL("../package-lock.json", import.meta.url)))
  .update(require("subset-font/package.json").version)
  .update(require("fontverter/package.json").version)
  .digest("hex");
const cache = new Map();
const cacheDir = resolve("node_modules/.astro/page-fonts");
await mkdir(cacheDir, { recursive: true });
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      ),
    )
  ).flat();
}
async function subset(characters, name) {
  const hash = createHash("sha256")
    .update(sourceHash)
    .update(characters)
    .digest("hex")
    .slice(0, 16);
  if (!cache.has(hash)) {
    const cacheFile = join(cacheDir, `${hash}.woff2`);
    let output = await readFontCache(cacheFile);
    if (!output) {
      output = await subsetFont(font, characters, {
        targetFormat: "woff2",
        preserveNameIds: nameIds,
      });
      await writeFontCache(cacheFile, output);
    }
    const assetHash = createHash("sha256")
      .update(output)
      .digest("hex")
      .slice(0, 16);
    const href = `/_astro/${name}-${assetHash}.woff2`;
    await writeFile(join(root, href), output);
    cache.set(hash, { href, bytes: output.length });
  }
  return cache.get(hash).href;
}
const pages = (await walk(root)).filter((file) => file.endsWith(".html"));
const documents = new Map();
const header = new Set();
for (const file of pages) {
  const html = await readFile(file, "utf8");
  if (html.includes("data-page-font"))
    throw new Error(`Page was already subset: ${file}`);
  documents.set(file, html);
  for (const char of headerCharacters(html)) header.add(char);
}
const headerText = [...header]
  .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  .join("");
const uiMarkup = uiFontMarkup(
  await subset(headerText, "seungil-sans-ui"),
  headerText,
);
for (const [file, html] of documents) {
  const characters = pageCharacters(html);
  const href = await subset(characters, "seungil-sans");
  // Insert after the shared CSS so this page's face comes first in the stack.
  // Native Astro navigation swaps this style with the document as usual.
  await writeFile(
    file,
    html.replace(
      "</head>",
      `${subsetMarkup(href, characters)}${uiMarkup}</head>`,
    ),
  );
}
await copyFile(
  join(packageRoot, "dist/LICENSE.txt"),
  join(root, "_astro/pretendard-OFL.txt"),
);
console.log(
  `Page fonts: ${pages.length} pages, ${cache.size} unique variable subsets (including the shared header subset), ${[...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0)} bytes total. Original font faces remain available for dynamic text.`,
);
