import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  normalizeTags,
  TAG_FORMAT_PATTERN,
} from "./tag-taxonomy.mjs";

const ROOT_DIR = process.cwd();
const BLOG_DIR = join(ROOT_DIR, "src/content/blog");
const CHECK_ONLY = process.argv.includes("--check");

async function walkFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(path);
      }

      return path;
    }),
  );

  return files.flat();
}

function unquoteYamlValue(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function parseInlineTags(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") {
    return [];
  }

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [unquoteYamlValue(trimmed)];
  }

  const body = trimmed.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  return body.split(",").map(unquoteYamlValue).filter(Boolean);
}

function parseTags(lines, tagsLineIndex) {
  const tagsLine = lines[tagsLineIndex];
  const inlineValue = tagsLine.replace(/^tags:\s*/, "");
  if (inlineValue.trim()) {
    return {
      tags: parseInlineTags(inlineValue),
      endIndex: tagsLineIndex,
    };
  }

  const tags = [];
  let endIndex = tagsLineIndex;

  for (let index = tagsLineIndex + 1; index < lines.length; index++) {
    const line = lines[index];
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!item) {
      break;
    }

    tags.push(unquoteYamlValue(item[1]));
    endIndex = index;
  }

  return { tags, endIndex };
}

function serializeTags(tags) {
  if (tags.length === 0) {
    return ["tags: []"];
  }

  return [
    "tags:",
    ...tags.map((tag) => `  - ${JSON.stringify(tag)}`),
  ];
}

function updateFrontmatterTags(markdown) {
  const frontmatter = markdown.match(/^(---\s*\n)([\s\S]*?)(\n---)/);
  if (!frontmatter) {
    return { markdown, changed: false, tags: [] };
  }

  const lines = frontmatter[2].split("\n");
  const tagsLineIndex = lines.findIndex((line) => /^tags:\s*/.test(line));
  if (tagsLineIndex === -1) {
    return { markdown, changed: false, tags: [] };
  }

  const { tags, endIndex } = parseTags(lines, tagsLineIndex);
  const normalizedTags = normalizeTags(tags);
  const replacement = serializeTags(normalizedTags);
  const nextLines = [
    ...lines.slice(0, tagsLineIndex),
    ...replacement,
    ...lines.slice(endIndex + 1),
  ];
  const nextFrontmatter = `${frontmatter[1]}${nextLines.join("\n")}${frontmatter[3]}`;
  const nextMarkdown = markdown.replace(frontmatter[0], nextFrontmatter);

  return {
    markdown: nextMarkdown,
    changed: nextMarkdown !== markdown,
    tags: normalizedTags,
  };
}

function assertValidTags(file, tags) {
  const seen = new Set();

  for (const tag of tags) {
    if (!TAG_FORMAT_PATTERN.test(tag)) {
      throw new Error(`Invalid tag "${tag}" in ${file}`);
    }

    if (seen.has(tag)) {
      throw new Error(`Duplicate tag "${tag}" in ${file}`);
    }

    seen.add(tag);
  }
}

async function main() {
  const files = (await walkFiles(BLOG_DIR)).filter((file) =>
    /\.(md|mdx)$/i.test(file),
  );
  const allTags = new Map();
  let changedCount = 0;

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    const result = updateFrontmatterTags(markdown);
    assertValidTags(file, result.tags);

    for (const tag of result.tags) {
      allTags.set(tag, (allTags.get(tag) ?? 0) + 1);
    }

    if (!result.changed) {
      continue;
    }

    changedCount++;
    if (!CHECK_ONLY) {
      await writeFile(file, result.markdown);
    }
  }

  if (CHECK_ONLY && changedCount > 0) {
    throw new Error(`${changedCount} files need tag normalization`);
  }

  console.log(`Files scanned: ${files.length}`);
  console.log(`Files ${CHECK_ONLY ? "needing changes" : "changed"}: ${changedCount}`);
  console.log(`Tags: ${allTags.size}`);
  for (const [tag, count] of [...allTags.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`${tag} (${count})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
