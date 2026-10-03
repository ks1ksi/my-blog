import { describe, expect, it } from "vitest";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { rehypeArticleImages, rehypeMathMetadata } from "./markdown";

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

describe("article image loading", () => {
  const images = unified({
    rehypePlugins: [rehypeArticleImages],
  }).createRenderer({});
  async function imageOptions(source: string) {
    const result = await (
      await images
    ).render(source, {
      fileURL: new URL("./fixture.md", import.meta.url),
    });
    return [...result.code.matchAll(/__ASTRO_IMAGE_="([^"]+)"/g)].map((match) =>
      JSON.parse(
        match[1]
          .replaceAll("&#x22;", '"')
          .replaceAll("&quot;", '"')
          .replaceAll("&amp;", "&"),
      ),
    );
  }

  it("makes a lead image eager and supplies article sizes, without prioritizing later images", async () => {
    const [lead, later] = await imageOptions(
      "Short intro.\n\n## Heading\n\n![Lead](./lead.png)\n\n![Later](./later.png)",
    );
    expect(lead).toMatchObject({
      src: "./lead.png",
      loading: "eager",
      fetchpriority: "high",
    });
    expect(lead.sizes).toContain("768px");
    expect(later.loading).toBeUndefined();
    expect(later.fetchpriority).toBeUndefined();
  });

  it("keeps images below long prose or a code block lazy", async () => {
    for (const prefix of [
      "A paragraph of article text. ".repeat(20),
      "```js\nconsole.log('example');\n```",
    ]) {
      const [image] = await imageOptions(
        `${prefix}\n\n![Diagram](./diagram.png)`,
      );
      expect(image.loading).toBeUndefined();
      expect(image.fetchpriority).toBeUndefined();
    }
  });

  it("does not transform public or remote images", async () => {
    const result = await (
      await images
    ).render(
      "![Public](/image.png)\n\n![Remote](https://example.com/image.png)",
    );
    expect(result.code).not.toContain('fetchpriority="high"');
    expect(result.code).not.toContain("calc(100vw");
  });
});
