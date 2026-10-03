import { parseFrontmatter } from "@astrojs/markdown-remark";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep, posix, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { slug as githubSlug } from "github-slugger";
import type { Image, Link, Parent, PhrasingContent, Text } from "mdast";
import type { Node, Position } from "unist";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";

type HProperties = Record<string, string | number>;

type ParentWithData = Parent & {
  data?: {
    hProperties?: HProperties;
  };
};

export type ObsidianPostTarget = {
  stem: string;
  draft?: boolean;
  slug?: string;
};

export type ObsidianLinkDiagnostic = {
  code: "missing-post" | "ambiguous-post" | "missing-image" | "ambiguous-image";
  message: string;
  target: string;
  source?: string;
  position?: Position;
  candidates: string[];
};

type ObsidianSourceFile = Partial<Pick<VFile, "path" | "history" | "message">>;

type ObsidianLinkContext = {
  file?: ObsidianSourceFile;
  position?: Position;
};

export type ObsidianLinkOptions = {
  contentDir?: string;
  imageDir?: string;
  posts?: ObsidianPostTarget[];
  images?: Iterable<string>;
  /** Replaces console warnings; remark file messages are still recorded. */
  onDiagnostic?: (diagnostic: ObsidianLinkDiagnostic) => void;
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
const OBSIDIAN_LINK_PATTERN = /(!?)\[\[(.+?)\]\]/g;
const BLOCK_ID_PATTERN = /(?:^|\s)\^([A-Za-z0-9_-]+)\s*$/;

function normalizeLookupKey(value: string) {
  return posix.normalize(value.trim().replaceAll("\\", "/")).toLowerCase();
}

function stripMarkdownExtension(filePath: string) {
  return filePath.replace(/\.(md|mdx)$/i, "");
}

function hasMarkdownExtension(filePath: string) {
  return /\.(md|mdx)$/i.test(filePath);
}

export function getPostSlug(stem: string, slug?: string) {
  // Match Astro's glob loader: non-empty custom slugs win; empty values use
  // the complete relative stem, including directories and index handling.
  if (slug) return String(slug);
  return stem
    .split("/")
    .map((segment) => githubSlug(segment))
    .join("/")
    .replace(/\/index$/, "");
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
    .map((path) => {
      const { frontmatter } = parseFrontmatter(readFileSync(path, "utf8"));
      return {
        stem: stripMarkdownExtension(relative(contentDir, path))
          .split(sep)
          .join("/"),
        draft: frontmatter.draft === true,
        slug: frontmatter.slug,
      };
    }) satisfies ObsidianPostTarget[];
}

function createImagesFromImageDir(imageDir = CONTENT_IMAGE_DIR) {
  return walkFiles(imageDir).map((path) =>
    relative(imageDir, path).split(sep).join("/"),
  );
}

type TargetIndex<T> = {
  paths: Map<string, T[]>;
  basenames: Map<string, T[]>;
};

function createTargetIndex<T>(
  items: Iterable<T>,
  getPath: (item: T) => string,
) {
  const index: TargetIndex<T> = { paths: new Map(), basenames: new Map() };
  for (const item of items) {
    const path = normalizeLookupKey(getPath(item));
    for (const [map, key] of [
      [index.paths, path],
      [index.basenames, posix.basename(path)],
    ] as const) {
      const matches = map.get(key) ?? [];
      matches.push(item);
      map.set(key, matches);
    }
  }
  return index;
}

function isRelativeReference(path: string) {
  return path.startsWith("./") || path.startsWith("../");
}

function findTargets<T>(
  index: TargetIndex<T>,
  target: string,
  currentDirectory = ".",
) {
  const path = target.trim().replaceAll("\\", "/");
  // Short references must be globally unique, even if a root-level file matches.
  // Explicit paths never fall back to an unrelated file with the same basename.
  if (!path.includes("/")) {
    return index.basenames.get(normalizeLookupKey(path)) ?? [];
  }
  const resolvedPath = isRelativeReference(path)
    ? posix.join(currentDirectory, path)
    : path.replace(/^\//, "");
  return index.paths.get(normalizeLookupKey(resolvedPath)) ?? [];
}

function logDiagnostic(diagnostic: ObsidianLinkDiagnostic) {
  const location = diagnostic.position?.start;
  const source = diagnostic.source ?? "unknown source";
  const suffix = location ? `:${location.line}:${location.column}` : "";
  console.warn(
    `[remark-obsidian-link] ${source}${suffix}: ${diagnostic.message}`,
  );
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
  const match = raw.match(/^(!?)\[\[(.+?)\]\]$/);
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
  const postIndex = createTargetIndex(posts, (post) => post.stem);
  const imageIndex = createTargetIndex(new Set(images), (image) => image);
  const imageRoot = relative(
    options.contentDir ?? BLOG_CONTENT_DIR,
    options.imageDir ?? CONTENT_IMAGE_DIR,
  )
    .split(sep)
    .join("/");

  return (
    token: ObsidianLinkToken,
    currentPostStem?: string,
    context: ObsidianLinkContext = {},
  ): PhrasingContent => {
    const currentStem = currentPostStem
      ? normalizeLookupKey(stripMarkdownExtension(currentPostStem))
      : undefined;
    const currentPosts = currentStem ? postIndex.paths.get(currentStem) : [];
    const currentDirectory = posix.dirname(
      currentPostStem?.replaceAll("\\", "/") ?? "",
    );

    function reportUnresolved(kind: "post" | "image", candidates: string[]) {
      // Unpublished notes can contain unfinished references without build noise.
      if (currentPosts?.length === 1 && currentPosts[0].draft) return;
      const ambiguous = candidates.length > 1;
      const diagnostic: ObsidianLinkDiagnostic = {
        code: `${ambiguous ? "ambiguous" : "missing"}-${kind}`,
        message: ambiguous
          ? `Ambiguous Obsidian ${kind} reference ${JSON.stringify(token.raw)}. Matches: ${candidates.map((path) => JSON.stringify(path)).join(", ")}. Use an explicit path to select the intended file. Left as plain text.`
          : `Missing Obsidian ${kind} reference ${JSON.stringify(token.raw)}. Check that the target exists and its path is correct. Left as plain text.`,
        target: token.target,
        source:
          context.file?.path ?? context.file?.history?.[0] ?? currentPostStem,
        position: context.position,
        candidates,
      };
      context.file?.message?.(diagnostic.message, {
        place: diagnostic.position,
        source: "remark-obsidian-link",
        ruleId: diagnostic.code,
      });
      // Astro's Markdown renderer drops VFile.messages, so also emit a visible
      // warning (or the caller's reporter) rather than silently losing issues.
      (options.onDiagnostic ?? logDiagnostic)(diagnostic);
    }

    if (token.embedded) {
      const imagePath = token.target.trim().replaceAll("\\", "/");
      const matches = isRelativeReference(imagePath)
        ? (imageIndex.paths.get(
            normalizeLookupKey(
              posix.relative(
                imageRoot,
                posix.join(currentDirectory, imagePath),
              ),
            ),
          ) ?? [])
        : findTargets(imageIndex, imagePath);
      if (matches.length !== 1) {
        reportUnresolved("image", [...matches].sort());
        return {
          type: "text",
          value: isImageSizeAlias(token.alias)
            ? imagePath
            : getDisplayText(token),
        };
      }

      const resolvedImagePath = matches[0];
      const size = parseImageSize(token.alias);
      const alt = isImageSizeAlias(token.alias)
        ? imagePath
        : token.alias?.trim() || imagePath;

      return {
        type: "image",
        url: posix.relative(
          currentDirectory,
          posix.join(imageRoot, resolvedImagePath),
        ),
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

    const matches = findTargets(
      postIndex,
      stripMarkdownExtension(target.path),
      currentDirectory,
    );
    if (matches.length !== 1) {
      reportUnresolved("post", matches.map((post) => post.stem).sort());
      return { type: "text", value: displayText };
    }
    const post = matches[0];
    // A known draft is an intentional unpublished reference, not a broken link.
    if (post.draft) return { type: "text", value: displayText };

    const isSamePost = currentStem === normalizeLookupKey(post.stem);
    const url = isSamePost
      ? hash || "#"
      : `/blog/${getPostSlug(post.stem, post.slug)}/${hash}`;

    return {
      type: "link",
      url,
      children: [{ type: "text", value: displayText }],
    } as Link;
  };
}

function getCurrentPostStem(
  file: ObsidianSourceFile | undefined,
  contentDir = BLOG_CONTENT_DIR,
) {
  const filePath = file?.path ?? file?.history?.[0];
  if (!filePath) {
    return undefined;
  }

  return stripMarkdownExtension(
    isAbsolute(filePath) ? relative(contentDir, filePath) : filePath,
  )
    .split(sep)
    .join("/");
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

  return (tree: Node, file?: ObsidianSourceFile) => {
    transformBlockIds(tree);
    const currentPostStem = getCurrentPostStem(file, options.contentDir);

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
              newNodes.push(
                resolveObsidianLink(token, currentPostStem, {
                  file,
                  position: node.position,
                }),
              );
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
