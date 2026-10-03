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
import {
  pageCharacters,
  renameFont,
  subsetMarkup,
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
const pages = (await walk(root)).filter((file) => file.endsWith(".html"));
for (const file of pages) {
  const html = await readFile(file, "utf8");
  if (html.includes("data-page-font"))
    throw new Error(`Page was already subset: ${file}`);
  const characters = pageCharacters(html);
  const hash = createHash("sha256")
    .update(sourceHash)
    .update(characters)
    .digest("hex")
    .slice(0, 16);
  if (!cache.has(hash)) {
    let output;
    const cacheFile = join(cacheDir, `${hash}.woff2`);
    try {
      output = await readFile(cacheFile);
      if (output.toString("ascii", 0, 4) !== "wOF2") output = undefined;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!output) {
      output = await subsetFont(font, characters, {
        targetFormat: "woff2",
        preserveNameIds: nameIds,
      });
      await writeFile(cacheFile, output);
    }
    const assetHash = createHash("sha256")
      .update(output)
      .digest("hex")
      .slice(0, 16);
    const href = `/_astro/seungil-sans-${assetHash}.woff2`;
    await writeFile(join(root, href), output);
    cache.set(hash, { href, bytes: output.length });
  }
  const { href } = cache.get(hash);
  // Insert after the shared CSS so this page's face comes first in the stack.
  // Native Astro navigation swaps this style with the document as usual.
  await writeFile(
    file,
    html.replace("</head>", `${subsetMarkup(href, characters)}</head>`),
  );
}
await copyFile(
  join(packageRoot, "dist/LICENSE.txt"),
  join(root, "_astro/pretendard-OFL.txt"),
);
console.log(
  `Page fonts: ${pages.length} pages, ${cache.size} unique variable subsets, ${[...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0)} bytes total. Original font faces remain available for dynamic text.`,
);
