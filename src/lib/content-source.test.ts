import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? markdownFiles(path)
      : /\.mdx?$/.test(path)
        ? [path]
        : [];
  });
}

it("contains no accidental invisible control characters in article sources", () => {
  const directory = join(process.cwd(), "src/content/blog");
  const failures = markdownFiles(directory).flatMap((path) => {
    const text = readFileSync(path, "utf8");
    return [
      ...text.matchAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g),
    ].map(
      (match) =>
        `${relative(directory, path)}:${text.slice(0, match.index).split("\n").length}: U+${match[0].charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  });
  expect(failures).toEqual([]);
});
