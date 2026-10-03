import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { parseCommit } from "./build-metadata.mjs";
import { SITE_URL } from "../src/config/site.mjs";

export function verifyBuildMetadata(metadata, expectedCommit) {
  const expected = parseCommit(expectedCommit);
  if (metadata?.schemaVersion !== 1 || metadata.commit !== expected) {
    throw new Error(
      `Expected deployment ${expected}; received ${metadata?.commit ?? "no build identity"}.`,
    );
  }
  if (metadata.dirty !== false) {
    throw new Error(
      "Deployment was built from a modified or unverifiable checkout.",
    );
  }
  return expected;
}

export function readOptions(args) {
  const options = { url: SITE_URL, commit: undefined, waitSeconds: 0 };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!value || !["--url", "--commit", "--wait-seconds"].includes(name)) {
      throw new Error(
        "Usage: npm run check:production -- --commit <full SHA> [--url <origin>] [--wait-seconds <seconds>]",
      );
    }
    if (name === "--url") options.url = value;
    if (name === "--commit") options.commit = parseCommit(value);
    if (name === "--wait-seconds") options.waitSeconds = Number(value);
  }
  if (!options.commit)
    throw new Error(
      "--commit is required; a successful HTTP response alone does not prove deployment.",
    );
  const url = new URL(options.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "--url must be an HTTP(S) origin without credentials, path, query, or fragment.",
    );
  }
  if (!Number.isFinite(options.waitSeconds) || options.waitSeconds < 0) {
    throw new Error("--wait-seconds must be a non-negative number.");
  }
  return options;
}

export async function checkProduction({ url, commit }, fetcher = fetch) {
  async function get(path) {
    const target = new URL(path, url);
    target.searchParams.set("verify", `${commit}-${Date.now()}`);
    const response = await fetcher(target, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    if (new URL(response.url || target).origin !== new URL(url).origin) {
      throw new Error(`${path}: unexpected cross-origin redirect`);
    }
    return response;
  }
  verifyBuildMetadata(await (await get("/build-info.json")).json(), commit);
  const checks = [
    ["/", /<html\b/i],
    ["/blog/", /<main\b/i],
    ["/tags/", /<main\b/i],
    ["/rss.xml", /<rss\b/],
    ["/sitemap-index.xml", /<sitemapindex\b/],
    ["/pagefind/pagefind.js", /pagefind/i],
  ];
  for (const [path, pattern] of checks) {
    if (!pattern.test(await (await get(path)).text())) {
      throw new Error(`${path}: unexpected response body`);
    }
  }
  // Ensure a rollout did not change identity while route checks were running.
  verifyBuildMetadata(await (await get("/build-info.json")).json(), commit);
  return checks.length;
}

export async function main(args = process.argv.slice(2)) {
  const options = readOptions(args);
  const deadline = Date.now() + options.waitSeconds * 1000;
  while (true) {
    try {
      const count = await checkProduction(options);
      console.log(
        `Verified clean deployment ${options.commit} at ${options.url}; ${count} public endpoints passed.`,
      );
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log(`Waiting for deployment: ${error.message}`);
      await delay(Math.min(10_000, Math.max(0, deadline - Date.now())));
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
