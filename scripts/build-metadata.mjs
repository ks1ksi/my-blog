import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function parseCommit(value) {
  if (
    typeof value !== "string" ||
    ![40, 64].includes(value.length) ||
    !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(value)
  ) {
    throw new Error("Expected a complete hexadecimal Git commit SHA.");
  }
  return value.toLowerCase();
}

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function createBuildMetadata(env = process.env, gitRead = git) {
  const checkout = gitRead("rev-parse", "HEAD");
  const supplied = env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA;
  const commit = parseCommit(supplied || checkout);
  if (checkout && parseCommit(checkout) !== commit) {
    throw new Error("The deployment commit does not match the checkout HEAD.");
  }
  const status = gitRead("status", "--porcelain", "--untracked-files=normal");
  // Unknown cleanliness is deliberately not asserted to be a verified release.
  return {
    schemaVersion: 1,
    commit,
    dirty: status === null ? null : status !== "",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const metadata = createBuildMetadata();
  writeFileSync(
    resolve(process.argv[2] ?? "dist", "build-info.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  console.log(
    `Build metadata: ${metadata.commit}${metadata.dirty === false ? " (clean checkout)" : " (unverified/modified checkout)"}`,
  );
}
