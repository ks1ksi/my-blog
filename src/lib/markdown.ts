import type { Root } from "hast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

// Match Container's article width (52rem) and its responsive horizontal padding.
const ARTICLE_IMAGE_SIZES =
  "(min-width: 1024px) 768px, (min-width: 832px) 784px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)";

export function rehypeArticleImages() {
  return (tree: Root) => {
    let precedingText = 0;
    let firstImage = true;
    let largeBlock = false;

    visit(tree, (node) => {
      if (node.type === "text") precedingText += node.value.trim().length;
      if (node.type !== "element") return;
      if (["pre", "table", "ul", "ol", "blockquote"].includes(node.tagName)) {
        largeBlock = true;
      }
      if (node.tagName !== "img") return;

      const earlyImage = firstImage && precedingText < 150 && !largeBlock;
      firstImage = false;
      // Leave public and remote images alone; Astro transforms imported local images.
      const src = node.properties.src;
      if (typeof src !== "string" || !src.startsWith(".")) return;

      // Explicit dimensions (including Obsidian embeds) keep Astro's own sizing.
      if (!node.properties.width) node.properties.sizes ??= ARTICLE_IMAGE_SIZES;
      // A lead image should be discoverable immediately, while later images stay lazy.
      if (earlyImage) {
        node.properties.loading ??= "eager";
        node.properties.fetchpriority ??= "high";
      }
    });
  };
}

// Use rendered math, not dollar signs in prose or code, to decide which pages need KaTeX CSS.
export function rehypeMathMetadata() {
  return (tree: Root, file: VFile) => {
    let hasMath = false;
    visit(tree, "element", (node) => {
      if (
        node.properties.className instanceof Array &&
        node.properties.className.includes("katex")
      ) {
        hasMath = true;
      }
    });
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.hasMath = hasMath;
  };
}
