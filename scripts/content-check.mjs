import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";

const root = path.resolve(process.argv[2] ?? "dist");
const origin = "https://ks1ksi.io";
const failures = [];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function elements(node) {
  return [node, ...(node.childNodes ?? []).flatMap(elements)];
}
function attrs(node) {
  return Object.fromEntries(
    (node.attrs ?? []).map(({ name, value }) => [name, value]),
  );
}
const pages = new Map();
for (const file of walk(root).filter((file) => file.endsWith(".html"))) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const route =
    relative === "404.html" ? "404/" : relative.replace(/index\.html$/, "");
  const url = new URL(`/${route}`, origin);
  const nodes = elements(parse(fs.readFileSync(file, "utf8"))).filter(
    (node) => node.tagName,
  );
  pages.set(file, {
    relative,
    url,
    nodes,
    ids: new Set(nodes.map((node) => attrs(node).id).filter(Boolean)),
  });
}
let posts = 0;
let mathPages = 0;
let checkedLinks = 0;
const indexableUrls = new Set();
const fail = (page, message) => failures.push(`${page.relative}: ${message}`);
function fileForUrl(url) {
  if (url.pathname === "/404/") return path.join(root, "404.html");
  const target = path.join(root, decodeURIComponent(url.pathname));
  return fs.existsSync(target) && fs.statSync(target).isDirectory()
    ? path.join(target, "index.html")
    : target;
}
for (const page of pages.values()) {
  const nodes = page.nodes.map((node) => ({
    tag: node.tagName,
    ...attrs(node),
  }));
  const fontStyles = page.nodes.filter(
    (node) => node.tagName === "style" && "data-page-font" in attrs(node),
  );
  const fontPreloads = nodes.filter(
    (node) =>
      node.tag === "link" && node.rel === "preload" && node.as === "font",
  );
  const fontCss =
    fontStyles[0]?.childNodes?.map((node) => node.value ?? "").join("") ?? "";
  if (
    fontStyles.length !== 1 ||
    fontPreloads.length !== 1 ||
    !("crossorigin" in (fontPreloads[0] ?? {})) ||
    !fontCss.includes(fontPreloads[0]?.href) ||
    !fontCss.includes("font-display:swap") ||
    !fontCss.includes('"Pretendard Variable"')
  ) {
    fail(page, "missing or inconsistent page font and dynamic-text fallback");
  }
  const meta = (name) =>
    nodes.find(
      (node) =>
        node.tag === "meta" && (node.name === name || node.property === name),
    )?.content;
  const canonical = nodes.find(
    (node) => node.tag === "link" && node.rel === "canonical",
  )?.href;
  if (canonical !== page.url.href)
    fail(page, `canonical must identify this page: ${canonical}`);
  if (meta("og:url") !== canonical) fail(page, "og:url differs from canonical");
  if (!meta("robots")?.includes("noindex")) indexableUrls.add(page.url.href);
  const post =
    page.relative.startsWith("blog/") && page.relative !== "blog/index.html";
  if (post) {
    posts++;
    if (!nodes.some((node) => "data-pagefind-body" in node))
      fail(page, "missing search body");
    const published = Date.parse(meta("article:published_time"));
    const modified = Date.parse(meta("article:modified_time"));
    if (
      !Number.isFinite(published) ||
      !Number.isFinite(modified) ||
      modified < published
    )
      fail(page, "invalid publication/modification dates");
  }
  const hasMath = nodes.some((node) =>
    node.class?.split(/\s+/).includes("katex"),
  );
  const mathStyle = nodes.some(
    (node) =>
      node.tag === "link" &&
      node.rel === "stylesheet" &&
      node.href?.includes("katex.min."),
  );
  if (hasMath) mathPages++;
  if (hasMath !== mathStyle)
    fail(page, "math stylesheet does not match rendered formulas");
  for (const node of nodes) {
    if (node.class?.split(/\s+/).includes("katex-error"))
      fail(page, `invalid formula: ${node.title}`);
    const value =
      node.tag === "a"
        ? node.href
        : ["img", "script"].includes(node.tag)
          ? node.src
          : node.tag === "link"
            ? node.href
            : undefined;
    if (!value) continue;
    const target = new URL(value, page.url);
    if (target.origin !== origin) continue;
    checkedLinks++;
    const targetFile = fileForUrl(target);
    if (!fs.existsSync(targetFile)) {
      fail(page, `missing local target: ${value}`);
      continue;
    }
    if (
      node.tag === "a" &&
      target.hash &&
      pages.has(targetFile) &&
      !pages.get(targetFile).ids.has(decodeURIComponent(target.hash.slice(1)))
    )
      fail(page, `missing anchor: ${value}`);
  }
}
const fontLicense = path.join(root, "_astro/pretendard-OFL.txt");
if (
  !fs.existsSync(fontLicense) ||
  !fs.readFileSync(fontLicense, "utf8").includes("SIL OPEN FONT LICENSE")
)
  failures.push("missing original font license");
const sitemapPaths = walk(root).filter((file) =>
  /sitemap-\d+\.xml$/.test(file),
);
const sitemapUrls = new Set(
  sitemapPaths.flatMap((file) =>
    [...fs.readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    ),
  ),
);
for (const url of indexableUrls)
  if (!sitemapUrls.has(url)) failures.push(`sitemap: missing ${url}`);
for (const url of sitemapUrls)
  if (!indexableUrls.has(url)) failures.push(`sitemap: unexpected ${url}`);
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
if (
  !robots.includes(`${origin}/sitemap-index.xml`) ||
  /^Disallow:\s*\/\s*$/im.test(robots)
)
  failures.push("robots.txt must advertise the sitemap and allow crawling");
const index = JSON.parse(
  fs.readFileSync(path.join(root, "pagefind/pagefind-entry.json"), "utf8"),
);
const indexedPages = Object.values(index.languages).reduce(
  (sum, language) => sum + language.page_count,
  0,
);
if (indexedPages !== posts)
  failures.push(`search must index ${posts} posts, got ${indexedPages}`);
console.log(
  JSON.stringify(
    {
      pages: pages.size,
      posts,
      mathPages,
      checkedLinks,
      sitemapUrls: sitemapUrls.size,
      indexedPages,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exit(1);
