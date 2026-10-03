import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "content" ? [] : files(path);
    return /\.(css|astro)$/.test(path) ? [path] : [];
  });
}

it("uses defined spacing tokens in component and shared styles", () => {
  const root = join(process.cwd(), "src");
  const sources = files(root).map((path) => ({
    path,
    text: readFileSync(path, "utf8"),
  }));
  const defined = new Set(
    sources.flatMap(({ text }) =>
      [...text.matchAll(/(--space-\d+)\s*:/g)].map((match) => match[1]),
    ),
  );
  const unresolved = sources.flatMap(({ path, text }) =>
    [...text.matchAll(/var\((--space-\d+)\)/g)]
      .filter((match) => !defined.has(match[1]))
      .map((match) => `${relative(root, path)}: ${match[1]}`),
  );
  expect(unresolved).toEqual([]);
});
