import fs from "node:fs";
import path from "node:path";

const distDir = process.argv[2] ?? "dist";
const RSS_MAX_BYTES = 10 * 1024 * 1024;
const NAVER_SITE_VERIFICATION = "bf086187e0346e29d6a4cc46934cf84a85d74c76";

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(fullPath, predicate);
    }

    return predicate(fullPath) ? [fullPath] : [];
  });
}

function getTagContent(html, tagName) {
  return html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"))?.[1]?.trim();
}

function getAttr(tag, attr) {
  return tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1]?.trim();
}

function getMetaContent(html, selector) {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const [attr, value] = selector;
  const tag = metas.find((meta) => getAttr(meta, attr) === value);

  return tag ? getAttr(tag, "content") : undefined;
}

function getLinkHref(html, rel) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = links.find((link) => getAttr(link, "rel") === rel);

  return tag ? getAttr(tag, "href") : undefined;
}

function getJsonLdScripts(html) {
  const scripts = html.match(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
  ) ?? [];

  return scripts.map((script) =>
    script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim(),
  );
}

const files = walkFiles(distDir, (file) => file.endsWith(".html"));

if (!fs.existsSync(distDir)) {
  console.error(`SEO check failed: ${distDir} does not exist. Run the build first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`SEO check failed: no HTML files found in ${distDir}.`);
  process.exit(1);
}

const summary = {
  files: files.length,
  missingTitle: 0,
  missingDescription: 0,
  invalidCanonical: 0,
  canonicalWithTrailingSlash: 0,
  missingOgTitle: 0,
  missingOgImage: 0,
  invalidH1Count: 0,
  missingLang: 0,
  invalidJsonLd: 0,
  indexableTagPages: 0,
  tagUrlsInSitemap: 0,
  missingNaverVerification: 0,
  missingRss: 0,
  rssItems: 0,
  rssContentItems: 0,
  rssTooLarge: 0,
  rootRelativeRssUrls: 0,
};
const failures = [];

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(distDir, file);
  const title = getTagContent(html, "title");
  const description = getMetaContent(html, ["name", "description"]);
  const canonical = getLinkHref(html, "canonical");
  const ogTitle = getMetaContent(html, ["property", "og:title"]);
  const ogImage = getMetaContent(html, ["property", "og:image"]);
  const robots = getMetaContent(html, ["name", "robots"]) ?? "";
  const naverVerification = getMetaContent(html, ["name", "naver-site-verification"]);
  const lang = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1];
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const jsonLdScripts = getJsonLdScripts(html);
  const problems = [];

  if (!title) {
    summary.missingTitle += 1;
    problems.push("missing title");
  }

  if (!description) {
    summary.missingDescription += 1;
    problems.push("missing meta description");
  }

  if (!canonical || !canonical.startsWith("https://ks1ksi.io/")) {
    summary.invalidCanonical += 1;
    problems.push("invalid canonical");
  } else if (canonical.length > "https://ks1ksi.io/".length && canonical.endsWith("/")) {
    summary.canonicalWithTrailingSlash += 1;
    problems.push("canonical has trailing slash");
  }

  if (!ogTitle) {
    summary.missingOgTitle += 1;
    problems.push("missing og:title");
  }

  if (!ogImage) {
    summary.missingOgImage += 1;
    problems.push("missing og:image");
  }

  if (h1Count !== 1) {
    summary.invalidH1Count += 1;
    problems.push(`expected 1 h1, got ${h1Count}`);
  }

  if (lang !== "ko") {
    summary.missingLang += 1;
    problems.push("missing html lang=ko");
  }

  for (const script of jsonLdScripts) {
    try {
      JSON.parse(script);
    } catch {
      summary.invalidJsonLd += 1;
      problems.push("invalid JSON-LD");
      break;
    }
  }

  if (rel.startsWith(`tags${path.sep}`) && !robots.includes("noindex")) {
    summary.indexableTagPages += 1;
    problems.push("tag page is indexable");
  }

  if (rel === "index.html" && naverVerification !== NAVER_SITE_VERIFICATION) {
    summary.missingNaverVerification += 1;
    problems.push("missing naver site verification");
  }

  if (problems.length > 0) {
    failures.push({ file: rel, problems });
  }
}

for (const sitemap of walkFiles(
  distDir,
  (file) => path.basename(file).startsWith("sitemap-") && file.endsWith(".xml"),
)) {
  const xml = fs.readFileSync(sitemap, "utf8");
  const tagUrls = xml.match(/<loc>https:\/\/ks1ksi\.io\/tags(?:\/[^<]*)?<\/loc>/g) ?? [];

  summary.tagUrlsInSitemap += tagUrls.length;
}

const rssPath = path.join(distDir, "rss.xml");
if (!fs.existsSync(rssPath)) {
  summary.missingRss = 1;
  failures.push({ file: "rss.xml", problems: ["missing RSS feed"] });
} else {
  const rssXml = fs.readFileSync(rssPath, "utf8");
  summary.rssItems = (rssXml.match(/<item>/g) ?? []).length;
  summary.rssContentItems = (rssXml.match(/<content:encoded>/g) ?? []).length;
  summary.rootRelativeRssUrls = (rssXml.match(/\s(?:href|src)=&quot;\/(?!\/)/g) ?? []).length;

  if (Buffer.byteLength(rssXml) >= RSS_MAX_BYTES) {
    summary.rssTooLarge = 1;
    failures.push({ file: "rss.xml", problems: ["RSS feed is 10MB or larger"] });
  }

  if (summary.rssItems === 0 || summary.rssContentItems !== summary.rssItems) {
    failures.push({ file: "rss.xml", problems: ["RSS items must include full content"] });
  }

  if (summary.rootRelativeRssUrls > 0) {
    failures.push({ file: "rss.xml", problems: ["RSS content contains root-relative URLs"] });
  }
}

console.log(JSON.stringify({ summary, failures: failures.slice(0, 25) }, null, 2));

const hardFailures =
  summary.missingTitle +
  summary.missingDescription +
  summary.invalidCanonical +
  summary.canonicalWithTrailingSlash +
  summary.missingOgTitle +
  summary.missingOgImage +
  summary.invalidH1Count +
  summary.missingLang +
  summary.invalidJsonLd +
  summary.indexableTagPages +
  summary.tagUrlsInSitemap +
  summary.missingNaverVerification +
  summary.missingRss +
  summary.rssTooLarge +
  (summary.rssItems === 0 || summary.rssContentItems !== summary.rssItems ? 1 : 0) +
  summary.rootRelativeRssUrls;

if (hardFailures > 0) {
  process.exit(1);
}
