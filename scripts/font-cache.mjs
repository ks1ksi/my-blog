import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hasValidHeader(bytes) {
  return (
    bytes.length >= 48 &&
    bytes.toString("ascii", 0, 4) === "wOF2" &&
    bytes.readUInt32BE(8) === bytes.length
  );
}

// Detect accidental truncation or corruption anywhere in the cached font,
// including damage that leaves the WOFF2 magic bytes intact. Missing/old
// metadata is a cache miss; regeneration is safer than trusting those bytes.
export async function readFontCache(path) {
  try {
    const [bytes, source] = await Promise.all([
      readFile(path),
      readFile(`${path}.json`, "utf8"),
    ]);
    const metadata = JSON.parse(source);
    if (
      !hasValidHeader(bytes) ||
      !metadata ||
      typeof metadata !== "object" ||
      metadata.version !== 1 ||
      metadata.bytes !== bytes.length ||
      metadata.sha256 !== digest(bytes)
    )
      return undefined;
    return bytes;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError)
      return undefined;
    throw error;
  }
}

export async function writeFontCache(path, bytes) {
  if (!hasValidHeader(bytes))
    throw new Error("Generated subset is not a complete WOFF2 font");
  await writeFile(path, bytes);
  await writeFile(
    `${path}.json`,
    JSON.stringify({ version: 1, bytes: bytes.length, sha256: digest(bytes) }),
  );
}
