import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parse } from "parse5";

const root = path.resolve(process.argv[2] ?? "dist");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function nodes(node) {
  return [node, ...(node.childNodes ?? []).flatMap(nodes)];
}
const links = nodes(
  parse(fs.readFileSync(path.join(root, "index.html"), "utf8")),
)
  .filter((node) => node.tagName === "link")
  .map((node) =>
    Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])),
  );
const sizes = (href) => {
  const data = fs.readFileSync(path.join(root, href));
  return { href, bytes: data.length, gzipBytes: gzipSync(data).length };
};
const stylesheets = links
  .filter((link) => link.rel === "stylesheet")
  .map((link) => sizes(link.href));
const searchFiles = walk(path.join(root, "pagefind"));
const entry = JSON.parse(
  fs.readFileSync(path.join(root, "pagefind/pagefind-entry.json"), "utf8"),
);
console.log(
  JSON.stringify(
    {
      stylesheets,
      homeCssBytes: stylesheets.reduce((sum, item) => sum + item.bytes, 0),
      homeCssGzipBytes: stylesheets.reduce(
        (sum, item) => sum + item.gzipBytes,
        0,
      ),
      favicon: sizes(links.find((link) => link.rel === "icon").href),
      searchIndexBytes: searchFiles.reduce(
        (sum, file) => sum + fs.statSync(file).size,
        0,
      ),
      indexedPages: Object.values(entry.languages).reduce(
        (sum, language) => sum + language.page_count,
        0,
      ),
    },
    null,
    2,
  ),
);
