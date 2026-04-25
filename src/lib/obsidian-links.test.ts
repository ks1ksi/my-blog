import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { slug as githubSlug } from "github-slugger";
import type { Root } from "mdast";
import {
  createObsidianLinkResolver,
  parseObsidianLinkToken,
  remarkObsidianLink,
  type ObsidianPostTarget,
} from "./utils";

const fixturePosts: ObsidianPostTarget[] = [
  { stem: "Simple Post" },
  { stem: "Real MySQL 8.0 8장 인덱스" },
  { stem: "2024 - 2025 회고" },
  { stem: "OSTEP 07 CPU Scheduling" },
  { stem: "OSTEP 38 Redundant Disk Arrays (RAID)" },
  { stem: "백준  2261번 가장 가까운 두 점" },
  { stem: "Draft Post", draft: true },
];

const fixtureImages = ["image.png", "nested/screenshot.jpeg"];

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

function resolveRaw(raw: string, currentPostStem = "Simple Post") {
  const token = parseObsidianLinkToken(raw);
  if (!token) {
    throw new Error(`Invalid token fixture: ${raw}`);
  }

  return createObsidianLinkResolver({
    posts: fixturePosts,
    images: fixtureImages,
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

function isDraft(content: string) {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return Boolean(frontmatter?.[1].match(/^draft:\s*true\s*$/im));
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
        url: "/blog/real-mysql-80-8장-인덱스",
        children: [{ type: "text", value: "DB index" }],
      },
      { type: "text", value: " after" },
    ]);
  });

  it("uses Astro-compatible slugs for punctuation, spacing, and Korean titles", () => {
    expect(resolveRaw("[[2024 - 2025 회고]]")).toMatchObject({
      type: "link",
      url: "/blog/2024---2025-회고",
    });
    expect(
      resolveRaw("[[OSTEP 38 Redundant Disk Arrays (RAID)]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/ostep-38-redundant-disk-arrays-raid",
    });
    expect(resolveRaw("[[백준  2261번 가장 가까운 두 점]]")).toMatchObject({
      type: "link",
      url: "/blog/백준--2261번-가장-가까운-두-점",
    });
  });

  it("supports heading, block, and same-page heading links", () => {
    expect(
      resolveRaw("[[Real MySQL 8.0 8장 인덱스#B-Tree 인덱스]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/real-mysql-80-8장-인덱스#b-tree-인덱스",
    });
    expect(
      resolveRaw("[[OSTEP 07 CPU Scheduling#^865cd1|타임 슬라이스]]"),
    ).toMatchObject({
      type: "link",
      url: "/blog/ostep-07-cpu-scheduling#^865cd1",
    });
    expect(resolveRaw("[[#Local Heading]]", "Simple Post")).toMatchObject({
      type: "link",
      url: "#local-heading",
    });
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
  });

  it("leaves draft or missing posts and missing images as text", () => {
    expect(resolveRaw("[[Draft Post|private note]]")).toEqual({
      type: "text",
      value: "private note",
    });
    expect(resolveRaw("[[Missing Post]]")).toEqual({
      type: "text",
      value: "Missing Post",
    });
    expect(resolveRaw("![[missing.png]]")).toEqual({
      type: "text",
      value: "missing.png",
    });
    expect(resolveRaw("![[missing.png|300]]")).toEqual({
      type: "text",
      value: "missing.png",
    });
  });
});

describe("actual content Obsidian links", () => {
  it("does not produce broken blog links from published content", () => {
    const contentDir = join(process.cwd(), "src/content/blog");
    const imageDir = join(process.cwd(), "src/content/images");
    const contentFiles = walkFiles(contentDir).filter((path) =>
      /\.(md|mdx)$/i.test(path),
    );
    const imageFiles = walkFiles(imageDir).map((path) =>
      relative(imageDir, path).split(sep).join("/"),
    );
    const posts = contentFiles.map((path) => ({
      stem: relative(contentDir, path)
        .replace(/\.(md|mdx)$/i, "")
        .split(sep)
        .join("/"),
      draft: isDraft(readFileSync(path, "utf8")),
    }));
    const publishedSlugs = new Set(
      posts
        .filter((post) => !post.draft)
        .map((post) => githubSlug(basename(post.stem))),
    );
    const resolve = createObsidianLinkResolver({
      posts,
      images: imageFiles,
    });

    const brokenLinks: string[] = [];
    const obsidianLinkPattern = /!?\[\[[^\]]+\]\]/g;

    for (const file of contentFiles) {
      const content = readFileSync(file, "utf8");
      if (isDraft(content)) {
        continue;
      }

      for (const [raw] of content.matchAll(obsidianLinkPattern)) {
        const token = parseObsidianLinkToken(raw);
        if (!token) {
          continue;
        }

        const node = resolve(
          token,
          relative(contentDir, file).replace(/\.(md|mdx)$/i, ""),
        );
        if (node.type !== "link" || !node.url.startsWith("/blog/")) {
          continue;
        }

        const slug = node.url.replace(/^\/blog\//, "").split("#")[0];
        if (!publishedSlugs.has(slug)) {
          brokenLinks.push(
            `${relative(contentDir, file)}: ${raw} -> ${node.url}`,
          );
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });
});
