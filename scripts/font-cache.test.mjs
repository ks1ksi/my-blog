import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFontCache, writeFontCache } from "./font-cache.mjs";

let directory;
let path;
const fixture = () => {
  const bytes = Buffer.alloc(64);
  bytes.write("wOF2", 0, "ascii");
  bytes.writeUInt32BE(bytes.length, 8);
  return bytes;
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "font-cache-"));
  path = join(directory, "font.woff2");
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

describe("font cache integrity", () => {
  it("reuses complete bytes with matching integrity metadata", async () => {
    const bytes = fixture();
    await writeFontCache(path, bytes);
    expect(await readFontCache(path)).toEqual(bytes);
  });
  it("regenerates after corruption even if the header is unchanged", async () => {
    await writeFontCache(path, fixture());
    const damaged = await readFile(path);
    damaged[damaged.length - 1] = 1;
    await writeFile(path, damaged);
    expect(await readFontCache(path)).toBeUndefined();
  });
  it("treats missing, truncated, old, or invalid metadata as cache misses", async () => {
    expect(await readFontCache(path)).toBeUndefined();
    await writeFile(path, fixture());
    expect(await readFontCache(path)).toBeUndefined();
    await writeFile(`${path}.json`, "invalid");
    expect(await readFontCache(path)).toBeUndefined();
    await writeFontCache(path, fixture());
    await writeFile(path, fixture().subarray(0, 48));
    expect(await readFontCache(path)).toBeUndefined();
  });
  it("treats valid JSON with an invalid metadata shape as a cache miss", async () => {
    await writeFile(path, fixture());
    for (const metadata of [null, [], "text", 1, {}]) {
      await writeFile(`${path}.json`, JSON.stringify(metadata));
      expect(await readFontCache(path)).toBeUndefined();
    }
  });
  it("rejects an incomplete generated font before caching", async () => {
    await expect(writeFontCache(path, Buffer.from("wOF2"))).rejects.toThrow(
      "complete WOFF2",
    );
  });
});
