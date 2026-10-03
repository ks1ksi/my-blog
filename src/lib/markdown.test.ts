import { describe, expect, it } from "vitest";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { rehypeMathMetadata } from "./markdown";

const processor = await unified({
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatex, rehypeMathMetadata],
}).createRenderer({});

describe("math stylesheet metadata", () => {
  it("loads math styles for actual inline and display formulas", async () => {
    for (const source of ["$x^2$", "$$\n\\frac{1}{2}\n$$"]) {
      const result = await processor.render(source);
      expect(result.code).toContain('class="katex"');
      expect(result.metadata.frontmatter.hasMath).toBe(true);
    }
  });
  it("does not load math styles for code or ordinary prose", async () => {
    for (const source of [
      "An ordinary paragraph.",
      "`$HOME`",
      "```sh\necho $HOME\n```",
      "It costs $5.",
    ]) {
      const result = await processor.render(source);
      expect(result.metadata.frontmatter.hasMath).toBe(false);
    }
  });
});
