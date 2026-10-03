import { describe, expect, it } from "vitest";
import { createBuildMetadata, parseCommit } from "./build-metadata.mjs";
import {
  checkProduction,
  readOptions,
  verifyBuildMetadata,
} from "./production-check.mjs";

const commit = "a".repeat(40);
const clean = { schemaVersion: 1, commit, dirty: false };

describe("deployment identity", () => {
  it("requires a full commit and rejects arbitrary environment values", () => {
    expect(parseCommit(commit.toUpperCase())).toBe(commit);
    for (const value of [
      "main",
      "a84fde",
      undefined,
      "token=secret",
      `${commit}\n`,
    ]) {
      expect(() => parseCommit(value)).toThrow();
    }
  });

  it("publishes only allowlisted metadata from a matching clean checkout", () => {
    const env = { CF_PAGES_COMMIT_SHA: commit, API_TOKEN: "never-publish" };
    expect(
      createBuildMetadata(env, (command) =>
        command === "rev-parse" ? commit : "",
      ),
    ).toEqual(clean);
    expect(() => createBuildMetadata(env, () => "b".repeat(40))).toThrow(
      /does not match/,
    );
  });

  it("marks modified and unknown worktrees as unverified", () => {
    expect(
      createBuildMetadata({}, (command) =>
        command === "rev-parse" ? commit : " M src/file.ts",
      ).dirty,
    ).toBe(true);
    expect(createBuildMetadata({ GITHUB_SHA: commit }, () => null).dirty).toBe(
      null,
    );
    expect(() =>
      verifyBuildMetadata({ ...clean, dirty: true }, commit),
    ).toThrow(/modified/);
    expect(() =>
      verifyBuildMetadata({ ...clean, dirty: null }, commit),
    ).toThrow(/unverifiable/);
    expect(() => verifyBuildMetadata(clean, "b".repeat(40))).toThrow(
      /Expected deployment/,
    );
  });

  it("requires an explicit expected commit and safe origin", () => {
    expect(() => readOptions([])).toThrow(/--commit/);
    expect(readOptions(["--commit", commit]).commit).toBe(commit);
    for (const url of [
      "file:///tmp/",
      "https://user:pass@example.com/",
      "https://example.com/path",
    ]) {
      expect(() => readOptions(["--commit", commit, "--url", url])).toThrow();
    }
  });

  it("checks route responses and rechecks the exact build identity", async () => {
    const bodies = {
      "/": "<html lang='ko'>",
      "/blog/": "<main>",
      "/tags/": "<main>",
      "/rss.xml": "<rss>",
      "/sitemap-index.xml": "<sitemapindex>",
      "/pagefind/pagefind.js": "// pagefind",
      "/build-info.json": JSON.stringify(clean),
    };
    const calls = [];
    const fetcher = async (url) => {
      calls.push(url.pathname);
      return new Response(bodies[url.pathname]);
    };
    await expect(
      checkProduction({ url: "https://example.com", commit }, fetcher),
    ).resolves.toBe(6);
    expect(calls.filter((path) => path === "/build-info.json")).toHaveLength(2);
    await expect(
      checkProduction(
        { url: "https://example.com", commit },
        async () => new Response("unavailable", { status: 503 }),
      ),
    ).rejects.toThrow(/503/);
  });
});
