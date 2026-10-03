import type { Root } from "hast";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

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
