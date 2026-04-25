import { clsx, type ClassValue } from "clsx";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { slug as githubSlug } from "github-slugger";
import type { Image, Link, Parent, PhrasingContent, Text } from "mdast";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { twMerge } from "tailwind-merge";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function readingTime(content: string) {
  const textOnly = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[\[.*?\]\]/g, " ")
    .replace(/\[\[(.*?)(?:\|.*?)?\]\]/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textOnly ? textOnly.split(" ").length : 0;

  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
}

type HProperties = Record<string, string | number>;

type ParentWithData = Parent & {
  data?: {
    hProperties?: HProperties;
  };
};

export type ObsidianPostTarget = {
  stem: string;
  draft?: boolean;
};

export type ObsidianLinkOptions = {
  contentDir?: string;
  imageDir?: string;
  posts?: ObsidianPostTarget[];
  images?: Iterable<string>;
};

type ObsidianLinkToken = {
  raw: string;
  embedded: boolean;
  target: string;
  alias?: string;
};

const BLOG_CONTENT_DIR = fileURLToPath(
  new URL("../content/blog", import.meta.url),
);
const CONTENT_IMAGE_DIR = fileURLToPath(
  new URL("../content/images", import.meta.url),
);
const OBSIDIAN_LINK_PATTERN = /(!?)\[\[([^\]]+)\]\]/g;
const BLOCK_ID_PATTERN = /(?:^|\s)\^([A-Za-z0-9_-]+)\s*$/;

function normalizeLookupKey(value: string) {
  return value.trim().replaceAll("\\", "/").toLowerCase();
}

function stripMarkdownExtension(filePath: string) {
  return filePath.replace(/\.(md|mdx)$/i, "");
}

function hasMarkdownExtension(filePath: string) {
  return /\.(md|mdx)$/i.test(filePath);
}

function isDraft(content: string) {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return Boolean(frontmatter?.[1].match(/^draft:\s*true\s*$/im));
}

function walkFiles(dir: string) {
  if (!existsSync(dir)) {
    return [];
  }

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

function createPostsFromContentDir(contentDir = BLOG_CONTENT_DIR) {
  return walkFiles(contentDir)
    .filter(hasMarkdownExtension)
    .map((path) => ({
      stem: stripMarkdownExtension(relative(contentDir, path))
        .split(sep)
        .join("/"),
      draft: isDraft(readFileSync(path, "utf8")),
    })) satisfies ObsidianPostTarget[];
}

function createImagesFromImageDir(imageDir = CONTENT_IMAGE_DIR) {
  return walkFiles(imageDir).map((path) =>
    relative(imageDir, path).split(sep).join("/"),
  );
}

function createPostIndex(posts: ObsidianPostTarget[]) {
  const index = new Map<string, ObsidianPostTarget>();

  for (const post of posts) {
    index.set(normalizeLookupKey(post.stem), post);
    index.set(normalizeLookupKey(basename(post.stem)), post);
  }

  return index;
}

function createImageIndex(images: Iterable<string>) {
  const index = new Map<string, string>();

  for (const image of images) {
    index.set(normalizeLookupKey(image), image);
    index.set(normalizeLookupKey(basename(image)), image);
  }

  return index;
}

function splitFirst(value: string, delimiter: string) {
  const index = value.indexOf(delimiter);
  if (index === -1) {
    return [value] as const;
  }

  return [
    value.slice(0, index),
    value.slice(index + delimiter.length),
  ] as const;
}

export function parseObsidianLinkToken(raw: string): ObsidianLinkToken | null {
  const match = raw.match(/^(!?)\[\[([^\]]+)\]\]$/);
  if (!match) {
    return null;
  }

  const [, embeddedMarker, body] = match;
  const [target, alias] = splitFirst(body, "|");

  return {
    raw,
    embedded: embeddedMarker === "!",
    target: target.trim(),
    alias,
  };
}

function getDisplayText(token: ObsidianLinkToken) {
  const alias = token.alias?.trim();
  if (alias) {
    return alias;
  }

  const [target, subpath] = splitFirst(token.target, "#");
  if (target.trim()) {
    return target.trim();
  }

  return subpath?.trim() ?? token.target.trim();
}

function parseTarget(target: string) {
  const [path, subpath] = splitFirst(target, "#");
  return {
    path: path.trim(),
    subpath: subpath?.trim(),
  };
}

function toSubpathHash(subpath: string | undefined) {
  if (!subpath) {
    return "";
  }

  if (subpath.startsWith("^")) {
    return `#${subpath}`;
  }

  return `#${githubSlug(subpath)}`;
}

function parseImageSize(alias: string | undefined) {
  const value = alias?.trim();
  if (!value) {
    return {};
  }

  const widthOnly = value.match(/^(\d+)$/);
  if (widthOnly) {
    return {
      width: Number(widthOnly[1]),
    };
  }

  const widthAndHeight = value.match(/^(\d+)x(\d+)$/i);
  if (widthAndHeight) {
    return {
      width: Number(widthAndHeight[1]),
      height: Number(widthAndHeight[2]),
    };
  }

  return {};
}

function isImageSizeAlias(alias: string | undefined) {
  return Boolean(alias?.trim().match(/^\d+(?:x\d+)?$/i));
}

export function createObsidianLinkResolver(options: ObsidianLinkOptions = {}) {
  const posts = options.posts ?? createPostsFromContentDir(options.contentDir);
  const images = options.images ?? createImagesFromImageDir(options.imageDir);
  const postIndex = createPostIndex(posts);
  const imageIndex = createImageIndex(images);

  return (
    token: ObsidianLinkToken,
    currentPostStem?: string,
  ): PhrasingContent => {
    if (token.embedded) {
      const imagePath = token.target.trim();
      const resolvedImagePath = imageIndex.get(normalizeLookupKey(imagePath));
      if (!resolvedImagePath) {
        return {
          type: "text",
          value: isImageSizeAlias(token.alias)
            ? imagePath
            : getDisplayText(token),
        };
      }

      const size = parseImageSize(token.alias);
      const alt = isImageSizeAlias(token.alias)
        ? imagePath
        : token.alias?.trim() || imagePath;

      return {
        type: "image",
        url: `../images/${resolvedImagePath}`,
        alt,
        data:
          "width" in size
            ? {
                hProperties: size,
              }
            : undefined,
      } as Image;
    }

    const target = parseTarget(token.target);
    const hash = toSubpathHash(target.subpath);
    const displayText = getDisplayText(token);

    if (!target.path) {
      return {
        type: "link",
        url: hash,
        children: [{ type: "text", value: displayText }],
      } as Link;
    }

    const post = postIndex.get(normalizeLookupKey(target.path));
    if (!post || post.draft) {
      return {
        type: "text",
        value: displayText,
      };
    }

    const postStem = post.stem.split("/").at(-1) ?? post.stem;
    const currentStem = currentPostStem
      ? normalizeLookupKey(stripMarkdownExtension(currentPostStem))
      : undefined;
    const postKey = normalizeLookupKey(post.stem);
    const isSamePost =
      currentStem === postKey || currentStem === normalizeLookupKey(postStem);
    const url = isSamePost
      ? hash || `#`
      : `/blog/${githubSlug(postStem)}${hash}`;

    return {
      type: "link",
      url,
      children: [{ type: "text", value: displayText }],
    } as Link;
  };
}

function getCurrentPostStem(file?: { path?: string; history?: string[] }) {
  const filePath = file?.path ?? file?.history?.[0];
  if (!filePath) {
    return undefined;
  }

  return stripMarkdownExtension(basename(filePath));
}

function transformBlockIds(tree: Node) {
  visit(tree, "paragraph", (node: ParentWithData) => {
    const lastChildIndex = node.children.length - 1;
    const lastChild = node.children[lastChildIndex];

    if (!lastChild || lastChild.type !== "text") {
      return;
    }

    const text = lastChild as Text;
    const match = text.value.match(BLOCK_ID_PATTERN);
    if (!match) {
      return;
    }

    const [, blockId] = match;
    text.value = text.value.replace(BLOCK_ID_PATTERN, "").trimEnd();
    if (!text.value) {
      node.children.splice(lastChildIndex, 1);
    }

    node.data ??= {};
    node.data.hProperties = {
      ...node.data.hProperties,
      id: `^${blockId}`,
    };
  });
}

export function remarkObsidianLink(options: ObsidianLinkOptions = {}) {
  const resolveObsidianLink = createObsidianLinkResolver(options);

  return (tree: Node, file?: { path?: string; history?: string[] }) => {
    transformBlockIds(tree);
    const currentPostStem = getCurrentPostStem(file);

    visit(
      tree,
      "text",
      (node: Text, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || index === undefined) return;
        if (!node.value.match(OBSIDIAN_LINK_PATTERN)) return;

        const newNodes: PhrasingContent[] = [];
        let lastIndex = 0;

        node.value.replace(
          OBSIDIAN_LINK_PATTERN,
          (match, _embedded, _body, offset) => {
            if (offset > lastIndex) {
              newNodes.push({
                type: "text",
                value: node.value.slice(lastIndex, offset),
              });
            }

            const token = parseObsidianLinkToken(match);
            if (token) {
              newNodes.push(resolveObsidianLink(token, currentPostStem));
            }

            lastIndex = offset + match.length;
            return match;
          },
        );

        if (lastIndex < node.value.length) {
          newNodes.push({
            type: "text",
            value: node.value.slice(lastIndex),
          });
        }

        parent.children.splice(index, 1, ...newNodes);
        return index + newNodes.length;
      },
    );
  };
}
