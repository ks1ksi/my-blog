import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { remarkObsidianLink } from "./src/lib/utils";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import GithubSlugger from "github-slugger";

const contentDir = fileURLToPath(
  new URL("./src/content/blog", import.meta.url),
);
const imageDir = fileURLToPath(
  new URL("./src/content/images", import.meta.url),
);

function walkMarkdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkMarkdownFiles(fullPath);
    }

    return /\.(md|mdx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function getFrontmatterValue(frontmatter, key) {
  return frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function normalizeFrontmatterValue(value) {
  if (!value || value === "null") {
    return undefined;
  }

  return value.replace(/^["']|["']$/g, "");
}

function createPostLastmodMap() {
  const posts = new Map();

  for (const file of walkMarkdownFiles(contentDir)) {
    const source = readFileSync(file, "utf8");
    const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? "";

    if (getFrontmatterValue(frontmatter, "draft") === "true") {
      continue;
    }

    const date = normalizeFrontmatterValue(getFrontmatterValue(frontmatter, "date"));
    const updatedDate = normalizeFrontmatterValue(
      getFrontmatterValue(frontmatter, "updatedDate"),
    );
    const lastmod = updatedDate ?? date;

    if (!lastmod) {
      continue;
    }

    const id = relative(contentDir, file).slice(0, -extname(file).length).replaceAll("\\", "/");
    const slug = new GithubSlugger().slug(id);

    posts.set(id, new Date(lastmod));
    posts.set(slug, new Date(lastmod));
  }

  return posts;
}

const postLastmodById = createPostLastmodMap();

function getBlogPostIdFromSitemapUrl(url) {
  const pathname = new URL(url).pathname;

  if (!pathname.startsWith("/blog/")) {
    return undefined;
  }

  const id = pathname.replace(/^\/blog\//, "").replace(/\/$/, "");

  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

// https://astro.build/config
export default defineConfig({
  site: "https://ks1ksi.io",
  output: "static",
  trailingSlash: "always",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/drafts/") && !page.includes("/tags"),
      serialize(item) {
        const postId = getBlogPostIdFromSitemapUrl(item.url);
        const lastmod = postId ? postLastmodById.get(postId) : undefined;

        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    mdx(),
    pagefind(),
  ],
  compressHTML: true,
  cacheDir: "./node_modules/.astro",
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
    remarkPlugins: [remarkMath, [remarkObsidianLink, { contentDir, imageDir }]],
    rehypePlugins: [rehypeKatex],
  },
});
