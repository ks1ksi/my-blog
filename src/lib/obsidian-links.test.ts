import {
  readdirSync,
  existsSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  createMarkdownProcessor,
  parseFrontmatter,
} from "@astrojs/markdown-remark";
import { VFile } from "vfile";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import {
  createObsidianLinkResolver,
  getPostSlug,
  type ObsidianLinkDiagnostic,
  type ObsidianLinkOptions,
  parseObsidianLinkToken,
  remarkObsidianLink,
  type ObsidianPostTarget,
} from "./obsidian-links";

const fixturePosts: ObsidianPostTarget[] = [
  { stem: "Simple Post" },
  { stem: "notes/Nested Post" },
  { stem: "Real MySQL 8.0 8장 인덱스" },
  { stem: "2024 - 2025 회고" },
  { stem: "OSTEP 07 CPU Scheduling" },
  { stem: "OSTEP 38 Redundant Disk Arrays (RAID)" },
  { stem: "백준  2261번 가장 가까운 두 점" },
  { stem: "Draft Post", draft: true },
];

const fixtureImages = [
  "image.png",
  "nested/screenshot.jpeg",
  "[Vue] v-model 과 v-bind + v-on-1-3d64d5046e.png",
];

function transformText(value: string, currentPostStem = "Simple Post") {
  const tree: Root = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{ type: "text", value }],
      },
    ],
  };
  const transform = remarkObsidianLink({
    posts: fixturePosts,
    images: fixtureImages,
  });

  transform(tree, { path: `${currentPostStem}.md` });

  const paragraph = tree.children[0];
  if (paragraph.type !== "paragraph") {
    throw new Error("Expected paragraph fixture.");
  }

  return paragraph.children;
}

function resolveRaw(
  raw: string,
  currentPostStem = "Simple Post",
  options: ObsidianLinkOptions = {},
) {
  const token = parseObsidianLinkToken(raw);
  if (!token) {
    throw new Error(`Invalid token fixture: ${raw}`);
  }

  return createObsidianLinkResolver({
    posts: fixturePosts,
    images: fixtureImages,
    ...options,
  })(token, currentPostStem);
}

function walkFiles(dir: string) {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

describe("remarkObsidianLink", () => {
  it("transforms links while preserving surrounding text and multiple tokens", () => {
    const children = transformText(
      "Before [[Simple Post]] and [[Real MySQL 8.0 8장 인덱스|DB index]] after",
    );

    expect(children).toEqual([
      { type: "text", value: "Before " },
      {
        type: "link",
        url: "#",
        children: [{ type: "text", value: "Simple Post" }],
      },
      { type: "text", value: " and " },
      {
        type: "link",
        url: "/blog/real-mysql-80-8장-인덱스/",
        children: [{ type: "text", value: "DB index" }],
      },
      { type: "text", value: " after" },
    ]);
  });

  it("uses Astro-compatible slugs for punctuation, spacing, and Korean titles", () => {
    expect(resolveRaw("[[2024 - 2025 회고]]")).toMatchObject({
      type: "link",
      url: "/blog/2024---2025-회고/",
    });
    expect(
      resolveRaw("[[OSTEP 38 Redundant Disk Arrays (RAID)]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/ostep-38-redundant-disk-arrays-raid/",
    });
    expect(resolveRaw("[[백준  2261번 가장 가까운 두 점]]")).toMatchObject({
      type: "link",
      url: "/blog/백준--2261번-가장-가까운-두-점/",
    });
  });

  it("supports heading, block, and same-page heading links", () => {
    expect(
      resolveRaw("[[Real MySQL 8.0 8장 인덱스#B-Tree 인덱스]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/real-mysql-80-8장-인덱스/#b-tree-인덱스",
    });
    expect(
      resolveRaw("[[OSTEP 07 CPU Scheduling#^865cd1|타임 슬라이스]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/ostep-07-cpu-scheduling/#^865cd1",
    });
    expect(resolveRaw("[[#Local Heading]]", "Simple Post")).toMatchObject({
      type: "link",
      url: "#local-heading",
    });
  });

  it("preserves nested post paths and accepts explicit Markdown extensions", () => {
    expect(resolveRaw("[[notes/Nested Post.md#Heading|nested]]")).toMatchObject(
      {
        type: "link",
        url: "/blog/notes/nested-post/#heading",
      },
    );
    expect(resolveRaw("[[Simple Post.md]]")).toMatchObject({
      type: "link",
      url: "#",
    });
    expect(resolveRaw("![[image.png]]", "notes/Nested Post")).toMatchObject({
      type: "image",
      url: "../../images/image.png",
    });
  });

  it("reads YAML comments and quoted keys when excluding drafts and preserving custom slugs", () => {
    const contentDir = mkdtempSync(join(tmpdir(), "blog-links-"));
    try {
      writeFileSync(
        join(contentDir, "Hidden.md"),
        '---\n"draft": true # private\ntitle: Hidden\ndate: 2026-01-01\n---\n',
      );
      writeFileSync(
        join(contentDir, "Published.md"),
        "---\nslug: stable-url # existing public address\ntitle: Published\ndate: 2026-01-01\n---\n",
      );
      const resolve = createObsidianLinkResolver({ contentDir, images: [] });
      expect(resolve(parseObsidianLinkToken("[[Hidden]]")!)).toMatchObject({
        type: "text",
      });
      expect(
        resolve(parseObsidianLinkToken("[[Published.md]]")!),
      ).toMatchObject({ type: "link", url: "/blog/stable-url/" });
    } finally {
      rmSync(contentDir, { recursive: true, force: true });
    }
  });

  it("transforms block markers into paragraph ids and removes marker text", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Block target text. ^abc-123" }],
        },
      ],
    };
    const transform = remarkObsidianLink({
      posts: fixturePosts,
      images: fixtureImages,
    });

    transform(tree, { path: "Simple Post.md" });

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      data: {
        hProperties: {
          id: "^abc-123",
        },
      },
      children: [{ type: "text", value: "Block target text." }],
    });
  });

  it("supports image embeds with alt text and dimensions", () => {
    expect(resolveRaw("![[image.png]]")).toMatchObject({
      type: "image",
      url: "../images/image.png",
      alt: "image.png",
    });
    expect(resolveRaw("![[image.png|diagram alt]]")).toMatchObject({
      type: "image",
      url: "../images/image.png",
      alt: "diagram alt",
    });
    expect(resolveRaw("![[image.png|300]]")).toMatchObject({
      type: "image",
      data: { hProperties: { width: 300 } },
    });
    expect(resolveRaw("![[nested/screenshot.jpeg|300x200]]")).toMatchObject({
      type: "image",
      data: { hProperties: { width: 300, height: 200 } },
    });
    expect(resolveRaw("![[screenshot.jpeg]]")).toMatchObject({
      type: "image",
      url: "../images/nested/screenshot.jpeg",
      alt: "screenshot.jpeg",
    });
    expect(
      resolveRaw("![[[Vue] v-model 과 v-bind + v-on-1-3d64d5046e.png]]"),
    ).toMatchObject({
      type: "image",
      url: "../images/[Vue] v-model 과 v-bind + v-on-1-3d64d5046e.png",
      alt: "[Vue] v-model 과 v-bind + v-on-1-3d64d5046e.png",
    });
  });

  it("leaves known drafts as text without diagnostics", () => {
    const onDiagnostic = vi.fn();
    expect(
      resolveRaw("[[Draft Post|private note]]", "Simple Post", {
        onDiagnostic,
      }),
    ).toEqual({
      type: "text",
      value: "private note",
    });
    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  it("warns about missing posts and images while preserving readable text", () => {
    const diagnostics: ObsidianLinkDiagnostic[] = [];
    const options = {
      onDiagnostic: (diagnostic: ObsidianLinkDiagnostic) =>
        diagnostics.push(diagnostic),
    };
    expect(resolveRaw("[[Missing Post]]", "Simple Post", options)).toEqual({
      type: "text",
      value: "Missing Post",
    });
    expect(resolveRaw("![[missing.png]]", "Simple Post", options)).toEqual({
      type: "text",
      value: "missing.png",
    });
    expect(resolveRaw("![[missing.png|300]]", "Simple Post", options)).toEqual({
      type: "text",
      value: "missing.png",
    });
    expect(diagnostics.map(({ code }) => code)).toEqual([
      "missing-post",
      "missing-image",
      "missing-image",
    ]);
    expect(diagnostics[0]).toMatchObject({
      source: "Simple Post",
      target: "Missing Post",
      candidates: [],
    });
    expect(diagnostics[0].message).toContain("[[Missing Post]]");
  });

  it("does not warn for unfinished references in known draft source files", () => {
    const onDiagnostic = vi.fn();
    expect(
      resolveRaw("[[Unwritten Post]]", "Draft Post", { onDiagnostic }),
    ).toMatchObject({ type: "text" });
    expect(
      resolveRaw("![[unfinished.png]]", "Draft Post", { onDiagnostic }),
    ).toMatchObject({ type: "text" });
    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "never picks a colliding post basename based on index order (reverse=%s)",
    (reverse) => {
      const posts = [
        { stem: "Same" },
        { stem: "notes/Same" },
        { stem: "private/Same", draft: true },
      ];
      const onDiagnostic = vi.fn();
      const options = {
        posts: reverse ? posts.reverse() : posts,
        onDiagnostic,
      };
      expect(resolveRaw("[[Same|ambiguous]]", "Simple Post", options)).toEqual({
        type: "text",
        value: "ambiguous",
      });
      expect(onDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ambiguous-post",
          candidates: ["Same", "notes/Same", "private/Same"],
        }),
      );
      expect(onDiagnostic.mock.calls[0][0].message).toContain("explicit path");
      expect(resolveRaw("[[notes/Same]]", "Same", options)).toMatchObject({
        type: "link",
        url: "/blog/notes/same/",
      });
      expect(resolveRaw("[[/Same]]", "notes/Same", options)).toMatchObject({
        type: "link",
        url: "/blog/same/",
      });
      expect(resolveRaw("[[./Same]]", "notes/Same", options)).toMatchObject({
        type: "link",
        url: "#",
      });
      expect(resolveRaw("[[private/Same]]", "Same", options)).toMatchObject({
        type: "text",
      });
      expect(onDiagnostic).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])(
    "never picks a colliding image basename based on index order (reverse=%s)",
    (reverse) => {
      const images = ["same.png", "one/same.png", "two/same.png"];
      const onDiagnostic = vi.fn();
      const options = {
        images: reverse ? images.reverse() : images,
        onDiagnostic,
      };
      expect(resolveRaw("![[same.png|300]]", "Simple Post", options)).toEqual({
        type: "text",
        value: "same.png",
      });
      expect(onDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ambiguous-image",
          candidates: ["one/same.png", "same.png", "two/same.png"],
        }),
      );
      expect(
        resolveRaw("![[one/same.png]]", "Simple Post", options),
      ).toMatchObject({ type: "image", url: "../images/one/same.png" });
      expect(
        resolveRaw("![[/same.png]]", "Simple Post", options),
      ).toMatchObject({ type: "image", url: "../images/same.png" });
      expect(onDiagnostic).toHaveBeenCalledTimes(1);
    },
  );

  it("diagnoses normalized full-path collisions instead of overwriting them", () => {
    const onDiagnostic = vi.fn();
    const options = {
      posts: [{ stem: "notes/Example" }, { stem: "notes/example" }],
      images: ["photos/Example.png", "photos/example.png"],
      onDiagnostic,
    };
    expect(
      resolveRaw("[[notes/Example]]", "Simple Post", options),
    ).toMatchObject({ type: "text" });
    expect(
      resolveRaw("![[photos/Example.png]]", "Simple Post", options),
    ).toMatchObject({ type: "text" });
    expect(
      onDiagnostic.mock.calls.map(([diagnostic]) => diagnostic.code),
    ).toEqual(["ambiguous-post", "ambiguous-image"]);
  });

  it("never falls back to a basename after an explicit path fails", () => {
    const onDiagnostic = vi.fn();
    expect(
      resolveRaw("[[wrong/Nested Post.md]]", "Simple Post", { onDiagnostic }),
    ).toMatchObject({ type: "text" });
    expect(
      resolveRaw("![[wrong/screenshot.jpeg]]", "Simple Post", { onDiagnostic }),
    ).toMatchObject({ type: "text" });
    expect(
      onDiagnostic.mock.calls.map(([diagnostic]) => diagnostic.code),
    ).toEqual(["missing-post", "missing-image"]);
  });

  it("resolves explicit relative post and image paths from the source directory", () => {
    expect(
      resolveRaw("[[./Nested Post.md#Heading]]", "notes/Other Post"),
    ).toMatchObject({ type: "link", url: "/blog/notes/nested-post/#heading" });
    expect(resolveRaw("[[../Simple Post]]", "notes/Nested Post")).toMatchObject(
      { type: "link", url: "/blog/simple-post/" },
    );
    expect(
      resolveRaw("[[../notes/Nested Post.mdx]]", "notes/Other Post"),
    ).toMatchObject({ type: "link", url: "/blog/notes/nested-post/" });
    expect(
      resolveRaw(
        "![[../../images/nested/screenshot.jpeg]]",
        "notes/Nested Post",
      ),
    ).toMatchObject({
      type: "image",
      url: "../../images/nested/screenshot.jpeg",
    });
    expect(resolveRaw("![[../images/image.png]]", "Simple Post")).toMatchObject(
      { type: "image", url: "../images/image.png" },
    );
  });

  it("preserves nested index routes and custom slugs", () => {
    const options = {
      posts: [
        { stem: "notes/index" },
        { stem: "notes/Custom Name", slug: "stable/nested-url" },
      ],
    };
    expect(getPostSlug("notes/index")).toBe("notes");
    expect(getPostSlug("notes/Custom Name", "")).toBe("notes/custom-name");
    expect(getPostSlug("notes/Custom Name", "stable/nested-url")).toBe(
      "stable/nested-url",
    );
    expect(resolveRaw("[[notes/index]]", "Simple Post", options)).toMatchObject(
      { type: "link", url: "/blog/notes/" },
    );
    expect(
      resolveRaw("[[notes/Custom Name#Heading]]", "Simple Post", options),
    ).toMatchObject({ type: "link", url: "/blog/stable/nested-url/#heading" });
  });

  it("attaches file location and rule to remark diagnostics and logs by default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = new VFile({ path: "/vault/blog/notes/Source.md" });
    const position = {
      start: { line: 12, column: 3, offset: 50 },
      end: { line: 12, column: 14, offset: 61 },
    };
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "[[Missing]]", position }],
        },
      ],
    };
    try {
      remarkObsidianLink({ contentDir: "/vault/blog", posts: [], images: [] })(
        tree,
        file,
      );
      expect(file.messages).toHaveLength(1);
      expect(file.messages[0]).toMatchObject({
        source: "remark-obsidian-link",
        ruleId: "missing-post",
        line: 12,
        column: 3,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("/vault/blog/notes/Source.md:12:3"),
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("[[Missing]]"));
    } finally {
      warn.mockRestore();
    }
  });

  it("uses absolute source paths and the history fallback for nested relative links", () => {
    for (const file of [
      { path: "/vault/blog/notes/Source.md" },
      { history: ["/vault/blog/notes/Source.md"] },
    ]) {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "[[./Nested Post]]" }],
          },
        ],
      };
      remarkObsidianLink({
        contentDir: "/vault/blog",
        posts: fixturePosts,
        images: [],
      })(tree, file);
      expect(tree.children[0]).toMatchObject({
        children: [{ type: "link", url: "/blog/notes/nested-post/" }],
      });
    }
  });

  it("does not inspect inline code, fenced code, or frontmatter as wiki references", async () => {
    const onDiagnostic = vi.fn();
    const renderer = await createMarkdownProcessor({
      syntaxHighlight: false,
      remarkPlugins: [
        [remarkObsidianLink, { posts: [], images: [], onDiagnostic }],
      ],
    });
    const source =
      '---\ntitle: "[[Not A Link]]"\n---\n`[[Inline Code]]`\n\n```text\n![[Fenced Code]]\n```';
    await renderer.render(parseFrontmatter(source).content);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("actual content Obsidian links", () => {
  it("has no missing or ambiguous targets in published Markdown", async () => {
    const contentDir = join(process.cwd(), "src/content/blog");
    const imageDir = join(process.cwd(), "src/content/images");
    const posts = walkFiles(contentDir)
      .filter((path) => /\.(md|mdx)$/i.test(path))
      .map((path) => {
        const parsed = parseFrontmatter(readFileSync(path, "utf8"), {
          frontmatter: "empty-with-spaces",
        });
        return {
          path,
          content: parsed.content,
          frontmatter: parsed.frontmatter,
          stem: relative(contentDir, path)
            .replace(/\.(md|mdx)$/i, "")
            .split(sep)
            .join("/"),
          draft: parsed.frontmatter.draft === true,
          slug: parsed.frontmatter.slug,
        };
      });
    const published = posts.filter((post) => !post.draft);
    const publishedSlugs = new Set(
      published.map((post) => getPostSlug(post.stem, post.slug)),
    );
    const diagnostics: ObsidianLinkDiagnostic[] = [];
    const brokenLinks: string[] = [];
    const brokenImages: string[] = [];
    let blogLinkCount = 0;
    let imageCount = 0;
    const renderer = await createMarkdownProcessor({
      syntaxHighlight: false,
      remarkPlugins: [
        [
          remarkObsidianLink,
          {
            contentDir,
            imageDir,
            onDiagnostic: (diagnostic: ObsidianLinkDiagnostic) =>
              diagnostics.push(diagnostic),
          },
        ],
        () => (tree: Root, file: VFile) => {
          visit(tree, "link", (node) => {
            if (!node.url.startsWith("/blog/")) return;
            blogLinkCount++;
            const slug = node.url
              .replace(/^\/blog\//, "")
              .split("#")[0]
              .replace(/\/$/, "");
            if (!publishedSlugs.has(slug))
              brokenLinks.push(`${file.path}: ${node.url}`);
          });
          visit(tree, "image", (node) => {
            imageCount++;
            if (/^(?:[a-z]+:|\/\/)/i.test(node.url)) return;
            const imagePath = join(dirname(file.path), node.url);
            if (!existsSync(imagePath))
              brokenImages.push(`${file.path}: ${node.url}`);
          });
        },
      ],
    });
    for (const post of published) {
      await renderer.render(post.content, {
        fileURL: pathToFileURL(post.path),
        frontmatter: post.frontmatter,
      });
    }
    // Diagnostics catch missing references even when they degrade to plain text.
    // Parsing real Markdown avoids treating code examples as links.
    expect(diagnostics).toEqual([]);
    expect(brokenLinks).toEqual([]);
    expect(brokenImages).toEqual([]);
    expect(blogLinkCount).toBeGreaterThan(0);
    expect(imageCount).toBeGreaterThan(0);
  });
});
