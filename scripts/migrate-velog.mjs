import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { slug as githubSlug } from "github-slugger";
import { normalizeTags } from "./tag-taxonomy.mjs";

const USERNAME = "ks1ksi";
const GRAPHQL_URL = "https://v2.velog.io/graphql";
const ROOT_DIR = process.cwd();
const BLOG_DIR = join(ROOT_DIR, "src/content/blog");
const IMAGE_DIR = join(ROOT_DIR, "src/content/images");
const REPORT_PATH = join(ROOT_DIR, "tmp/velog-migration-report.json");
const LIST_LIMIT = 50;
const CONCURRENCY = 6;

const LIST_POSTS_QUERY = `
  query Posts($username: String, $limit: Int, $cursor: ID) {
    posts(username: $username, limit: $limit, cursor: $cursor) {
      id
      title
      url_slug
      released_at
      updated_at
      tags
      thumbnail
      short_description
    }
  }
`;

const READ_POST_QUERY = `
  query ReadPost($username: String, $url_slug: String) {
    post(username: $username, url_slug: $url_slug) {
      id
      title
      body
      released_at
      updated_at
      tags
      thumbnail
      short_description
      is_markdown
      is_private
      url_slug
    }
  }
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphql(operationName, query, variables) {
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          operationName,
          variables,
          query,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.errors?.length) {
        throw new Error(json.errors.map((error) => error.message).join("; "));
      }

      return json.data;
    } catch (error) {
      lastError = error;
      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function fetchAllPostSummaries() {
  const posts = [];
  let cursor = null;

  while (true) {
    const data = await graphql("Posts", LIST_POSTS_QUERY, {
      username: USERNAME,
      limit: LIST_LIMIT,
      cursor,
    });
    const pagePosts = data.posts ?? [];
    if (pagePosts.length === 0) {
      break;
    }

    posts.push(...pagePosts);
    cursor = pagePosts.at(-1).id;
    console.log(`Fetched ${posts.length} post summaries`);
  }

  return posts;
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await callback(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function fetchPostDetails(summaries) {
  return mapLimit(summaries, CONCURRENCY, async (summary, index) => {
    const data = await graphql("ReadPost", READ_POST_QUERY, {
      username: USERNAME,
      url_slug: summary.url_slug,
    });
    const post = data.post;
    if (!post) {
      throw new Error(`Missing post detail: ${summary.title}`);
    }

    console.log(`Fetched detail ${index + 1}/${summaries.length}: ${post.title}`);
    return post;
  });
}

async function walkFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(path);
      }

      return path;
    }),
  );

  return files.flat();
}

function parseFrontmatterTitle(markdown) {
  const frontmatter = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  return frontmatter?.[1].match(/^title:\s*(.+)\s*$/m)?.[1]?.trim();
}

function unquoteYamlValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function canonicalTitle(title) {
  return normalizeMigratedTitle(title).toLowerCase();
}

async function getExistingPostTitles() {
  const files = (await walkFiles(BLOG_DIR)).filter((path) =>
    /\.(md|mdx)$/i.test(path),
  );
  const titles = new Map();

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    const rawTitle = parseFrontmatterTitle(markdown);
    if (!rawTitle) {
      continue;
    }

    titles.set(canonicalTitle(unquoteYamlValue(rawTitle)), file);
  }

  return titles;
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}

function yamlList(values) {
  if (!values?.length) {
    return "[]";
  }

  return `\n${values.map((value) => `  - ${yamlString(value)}`).join("\n")}`;
}

function toKoreanDate(isoDate) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function sanitizeFilePart(value) {
  return value
    .normalize("NFC")
    .replace(/[/:]/g, " ")
    .replace(/[\\?%*"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMigratedTitle(title) {
  return (title ?? "")
    .normalize("NFC")
    .replace(/:/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownLink(value) {
  const text = value.trim().replace(/\s+#+\s*$/, "");
  const link = text.match(/^\[([^\]]+)]\([^)]+\)$/);
  return link ? link[1] : text;
}

function normalizeComparableHeading(value) {
  return stripMarkdownLink(value)
    .normalize("NFC")
    .replace(/:/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function duplicateHeadingCandidates(title) {
  const normalizedTitle = normalizeComparableHeading(title);
  const withoutProblemPrefix = normalizedTitle.replace(
    /^(?:백준\s*)?\d+(?:번)?\s+/,
    "",
  );
  const withoutBracketPrefix = normalizedTitle.replace(/^\[[^\]]+]\s+/, "");

  return new Set([
    normalizedTitle,
    withoutProblemPrefix,
    withoutBracketPrefix,
  ]);
}

function removeDuplicateLeadingH1(body, title) {
  const firstHeading = body.match(/^(?:[ \t]*\r?\n)*#\s+([^\r\n]+)(?:\r?\n)?/);
  if (!firstHeading) {
    return body;
  }

  const heading = normalizeComparableHeading(firstHeading[1]);
  if (!duplicateHeadingCandidates(title).has(heading)) {
    return body;
  }

  return body.slice(firstHeading[0].length).replace(/^(?:[ \t]*\r?\n)+/, "");
}

function uniquePath(dir, baseName, extension) {
  let candidate = join(dir, `${baseName}${extension}`);
  let suffix = 2;

  while (existsSync(candidate)) {
    candidate = join(dir, `${baseName}-${suffix}${extension}`);
    suffix++;
  }

  return candidate;
}

function contentTypeToExtension(contentType) {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (type === "image/jpeg") return ".jpeg";
  if (type === "image/png") return ".png";
  if (type === "image/gif") return ".gif";
  if (type === "image/webp") return ".webp";
  if (type === "image/svg+xml") return ".svg";
  return "";
}

function urlExtension(url) {
  const extension = extname(new URL(url).pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(extension)) {
    return extension === ".jpg" ? ".jpeg" : extension;
  }

  return "";
}

function getImageUrls(markdown, thumbnail) {
  const urls = new Set();
  const markdownImagePattern = /!\[[^\]]*]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

  for (const match of markdown.matchAll(markdownImagePattern)) {
    urls.add(match[1]);
  }

  for (const match of markdown.matchAll(htmlImagePattern)) {
    urls.add(match[1]);
  }

  if (thumbnail) {
    urls.add(thumbnail);
  }

  return [...urls];
}

async function downloadImage(url, title, index, cache) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}): ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
  const extension =
    contentTypeToExtension(response.headers.get("content-type")) ||
    urlExtension(url) ||
    ".png";
  const baseName = `${sanitizeFilePart(title)}-${index}-${hash}`;
  const imagePath = uniquePath(IMAGE_DIR, baseName, extension);

  await writeFile(imagePath, buffer);

  const relativeImagePath = relative(IMAGE_DIR, imagePath);
  cache.set(url, relativeImagePath);
  return relativeImagePath;
}

async function localizeImages(post, cache) {
  let body = post.body ?? "";
  const title = normalizeMigratedTitle(post.title);
  const imageUrls = getImageUrls(body, post.thumbnail);
  const imageMap = new Map();

  for (let index = 0; index < imageUrls.length; index++) {
    const url = imageUrls[index];
    const localPath = await downloadImage(url, title, index + 1, cache);
    imageMap.set(url, localPath);
  }

  body = body.replace(
    /!\[([^\]]*)]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g,
    (match, alt, url) => {
      const localPath = imageMap.get(url);
      if (!localPath) {
        return match;
      }

      return alt?.trim()
        ? `![[${localPath}|${alt.trim()}]]`
        : `![[${localPath}]]`;
    },
  );

  body = body.replace(
    /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
    (match, url) => {
      const localPath = imageMap.get(url);
      return localPath ? `![[${localPath}]]` : match;
    },
  );

  return {
    body,
    imageCount: imageUrls.length,
  };
}

function localizeVelogPostLinks(body, velogSlugRouteMap) {
  return body.replace(
    /https:\/\/velog\.io\/@ks1ksi\/([^)\s"'<>]+)/g,
    (match, encodedSlug) => {
      let slug = encodedSlug;
      try {
        slug = decodeURIComponent(encodedSlug);
      } catch {
        return match;
      }

      return velogSlugRouteMap.get(slug) ?? match;
    },
  );
}

function toMarkdownFile(post, body) {
  const title = normalizeMigratedTitle(post.title);
  const cleanedBody = removeDuplicateLeadingH1(body, title);
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `date: ${toKoreanDate(post.released_at)}`,
    `tags:${yamlList(normalizeTags(post.tags ?? []))}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${frontmatter}\n\n${cleanedBody.trim()}\n`;
}

async function migrate() {
  await mkdir(BLOG_DIR, { recursive: true });
  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(join(ROOT_DIR, "tmp"), { recursive: true });

  const summaries = await fetchAllPostSummaries();
  const dedupedSummaries = [
    ...new Map(summaries.map((post) => [post.id, post])).values(),
  ];
  const details = await fetchPostDetails(dedupedSummaries);
  const existingTitles = await getExistingPostTitles();
  const imageCache = new Map();
  const velogSlugRouteMap = new Map(
    details.map((post) => [
      post.url_slug,
      `/blog/${githubSlug(sanitizeFilePart(normalizeMigratedTitle(post.title)))}`,
    ]),
  );
  const report = {
    fetched: details.length,
    created: [],
    skippedDuplicates: [],
    imagesDownloaded: 0,
    uniqueImagesDownloaded: 0,
    totalBlogFiles: 0,
    totalImageFiles: 0,
  };

  for (const post of details) {
    const title = normalizeMigratedTitle(post.title);
    const key = canonicalTitle(title);
    const existingFile = existingTitles.get(key);
    if (existingFile) {
      report.skippedDuplicates.push({
        title,
        existingFile: relative(ROOT_DIR, existingFile),
      });
      continue;
    }

    const { body, imageCount } = await localizeImages(post, imageCache);
    const markdown = toMarkdownFile(
      post,
      localizeVelogPostLinks(body, velogSlugRouteMap),
    );
    const filePath = uniquePath(BLOG_DIR, sanitizeFilePart(title), ".md");

    await writeFile(filePath, markdown);
    existingTitles.set(key, filePath);
    report.created.push(relative(ROOT_DIR, filePath));
    report.imagesDownloaded += imageCount;
    console.log(`Created ${relative(ROOT_DIR, filePath)}`);
  }

  const uniqueImages = new Set(imageCache.values());
  report.uniqueImagesDownloaded = uniqueImages.size;
  report.totalBlogFiles = (await walkFiles(BLOG_DIR)).filter((path) =>
    /\.(md|mdx)$/i.test(path),
  ).length;
  report.totalImageFiles = (await walkFiles(IMAGE_DIR)).length;

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  const missingFiles = await Promise.all(
    report.created.map(async (file) => {
      const path = join(ROOT_DIR, file);
      return (await stat(path)).size > 0 ? null : file;
    }),
  );
  const emptyFiles = missingFiles.filter(Boolean);
  if (emptyFiles.length > 0) {
    throw new Error(`Empty generated files: ${emptyFiles.join(", ")}`);
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
