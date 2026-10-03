import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fontverter from "fontverter";
import subsetFont from "subset-font";
import {
  pageCharacters,
  renameFont,
  subsetMarkup,
  unicodeRange,
} from "../../scripts/font-subset-utils.mjs";

function tables(font) {
  const result = new Map();
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    const start = font.readUInt32BE(at + 8);
    result.set(
      font.toString("ascii", at, at + 4),
      font.subarray(start, start + font.readUInt32BE(at + 12)),
    );
  }
  return result;
}

function names(font) {
  const table = tables(font).get("name");
  const result = new Map();
  for (let i = 0; i < table.readUInt16BE(2); i++) {
    const at = 6 + i * 12;
    const id = table.readUInt16BE(at + 6);
    const start = table.readUInt16BE(4) + table.readUInt16BE(at + 10);
    const value = Buffer.from(
      table.subarray(start, start + table.readUInt16BE(at + 8)),
    );
    const platform = table.readUInt16BE(at);
    const text =
      platform === 0 || platform === 3
        ? value.swap16().toString("utf16le")
        : value.toString("latin1");
    result.set(id, [...(result.get(id) ?? []), text]);
  }
  return result;
}

describe("page font character coverage", () => {
  it("includes body text, entities, collapsed controls and template content", () => {
    const chars = pageCharacters(
      '<html><head><title>無</title></head><body><p>회고 &amp; 한글 😀</p><details><summary>목차</summary>숨김</details><template>댓글</template><script>私</script><style>密</style><pre>字</pre><code>例</code><span class="katex">數</span></body></html>',
    );
    for (const char of "회고&한글😀목차숨김댓글0AZaz•−")
      expect(chars).toContain(char);
    for (const char of "無私密字例數") expect(chars).not.toContain(char);
    expect(new Set(chars).size).toBe([...chars].length);
  });

  it("compacts ranges without claiming missing characters", () => {
    expect(unicodeRange("caa😀bdg")).toBe("U+61-64,U+67,U+1f600");
  });

  it("keeps swap behavior, original fallbacks and all design weights", () => {
    const markup = subsetMarkup("/_astro/example.woff2", "가나다");
    expect(markup).toContain('as="font"');
    expect(markup).toContain("crossorigin");
    expect(markup).toContain("font-weight:45 920");
    expect(markup).toContain("font-display:swap");
    expect(markup).toContain('"Seungil Sans","Pretendard Variable"');
    expect(markup).toContain("unicode-range:U+ac00,U+b098,U+b2e4");
  });
});

describe("font subsetting preserves type design and attribution", () => {
  it("renames reserved identity only, retains the other SFNT tables and embeds license metadata", async () => {
    const original = await fontverter.convert(
      readFileSync(
        new URL(
          "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
          import.meta.url,
        ),
      ),
      "sfnt",
    );
    const renamed = renameFont(original);
    const before = tables(original);
    const after = tables(renamed.font);
    for (const [tag, bytes] of before) {
      if (tag === "name" || tag === "head") continue;
      expect(after.get(tag), tag).toEqual(bytes);
    }
    expect(names(renamed.font).get(1)).toContain("Seungil Sans");
    for (const [id, values] of names(renamed.font)) {
      if ([1, 3, 4, 6, 16, 21, 25].includes(id) || id >= 256)
        expect(values.join(" "), `font identity ${id}`).not.toContain(
          "Pretendard",
        );
    }
    for (const id of [0, 7, 8, 9, 11, 12, 13, 14])
      expect(names(renamed.font).get(id), `name ${id}`).toEqual(
        names(original).get(id),
      );
    const subset = await subsetFont(renamed.font, "Seungil 김승일 회고 2026", {
      targetFormat: "woff2",
      preserveNameIds: renamed.nameIds,
    });
    const sfnt = await fontverter.convert(subset, "sfnt");
    expect(tables(sfnt).get("fvar")).toEqual(after.get("fvar"));
    expect(names(sfnt).get(13)?.join(" ")).toContain("SIL Open Font License");
    expect(names(sfnt).get(1)).toContain("Seungil Sans");
    expect(subset.length).toBeLessThan(original.length);
  }, 30000);
});
