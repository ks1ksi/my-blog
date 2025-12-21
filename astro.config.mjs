import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import { remarkObsidianLink } from "./src/lib/utils";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// https://astro.build/config
export default defineConfig({
  site: "https://ks1ksi.io",
  integrations: [sitemap(), mdx(), pagefind()],
  redirects: {
    '/posts/[...slug]': '/blog/[...slug]',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
    remarkPlugins: [
      remarkMath,
      remarkObsidianLink,
    ],
    rehypePlugins: [
      rehypeKatex,
    ],
  },
});
