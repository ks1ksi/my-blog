import { defineConfig } from "astro/config";
import { SITE_URL } from "./src/config/site.mjs";
import { unified, parseFrontmatter } from "@astrojs/markdown-remark";
import { rehypeArticleImages, rehypeMathMetadata } from "./src/lib/markdown";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { remarkObsidianLink, getPostSlug } from "./src/lib/obsidian-links";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

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

function createPostLastmodMap() {
  const posts = new Map();

  for (const file of walkMarkdownFiles(contentDir)) {
    const source = readFileSync(file, "utf8");
    const { frontmatter } = parseFrontmatter(source);

    if (frontmatter.draft === true) {
      continue;
    }

    const lastmod = frontmatter.updatedDate ?? frontmatter.date;

    if (!lastmod) {
      continue;
    }

    const id = relative(contentDir, file)
      .slice(0, -extname(file).length)
      .replaceAll("\\", "/");
    const slug = getPostSlug(id, frontmatter.slug);

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
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  // Start rendering without an extra stylesheet round trip on mobile networks.
  build: { inlineStylesheets: "always" },
  image: {
    layout: "constrained",
    breakpoints: [384, 640, 768, 1024, 1536],
  },
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
    processor: unified({
      remarkPlugins: [
        remarkMath,
        [remarkObsidianLink, { contentDir, imageDir }],
      ],
      rehypePlugins: [rehypeKatex, rehypeMathMetadata, rehypeArticleImages],
    }),
  },
});
