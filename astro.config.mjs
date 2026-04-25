import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { remarkObsidianLink } from "./src/lib/utils";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { fileURLToPath } from "node:url";

const contentDir = fileURLToPath(
  new URL("./src/content/blog", import.meta.url),
);
const imageDir = fileURLToPath(
  new URL("./src/content/images", import.meta.url),
);

// https://astro.build/config
export default defineConfig({
  site: "https://ks1ksi.io",
  integrations: [sitemap(), mdx(), pagefind()],
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
