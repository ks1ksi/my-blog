import { parse } from "parse5";

export const SUBSET_FAMILY = "Seungil Sans";
const FONT_NAME_IDS = new Set([1, 3, 4, 6, 16, 21, 25]);

// Rebuild only the SFNT name table. Glyphs, metrics, hinting and variation
// tables are unchanged. Renaming respects Pretendard's reserved font name.
export function renameFont(font) {
  const count = font.readUInt16BE(4);
  const tables = Array.from({ length: count }, (_, index) => {
    const at = 12 + index * 16;
    const tag = font.toString("ascii", at, at + 4);
    const start = font.readUInt32BE(at + 8);
    return {
      tag,
      data: Buffer.from(
        font.subarray(start, start + font.readUInt32BE(at + 12)),
      ),
    };
  });
  const name = tables.find((table) => table.tag === "name");
  if (!name || name.data.readUInt16BE(0) !== 0) {
    throw new Error("Expected an SFNT font with a format-0 name table");
  }
  const records = name.data.readUInt16BE(2);
  const stringsAt = name.data.readUInt16BE(4);
  const header = Buffer.from(name.data.subarray(0, 6 + records * 12));
  header.writeUInt16BE(header.length, 4);
  const strings = [];
  const nameIds = new Set();
  let length = 0;
  for (let index = 0; index < records; index++) {
    const at = 6 + index * 12;
    const platform = header.readUInt16BE(at);
    const id = header.readUInt16BE(at + 6);
    nameIds.add(id);
    const offset = name.data.readUInt16BE(at + 10);
    let value = Buffer.from(
      name.data.subarray(
        stringsAt + offset,
        stringsAt + offset + header.readUInt16BE(at + 8),
      ),
    );
    // Variable-instance PostScript names live in the custom name-ID range.
    if (FONT_NAME_IDS.has(id) || id >= 256) {
      const unicode = platform === 0 || platform === 3;
      const text = unicode
        ? Buffer.from(value).swap16().toString("utf16le")
        : value.toString("latin1");
      const renamed = text
        .replaceAll("Pretendard Variable", SUBSET_FAMILY)
        .replaceAll("PretendardVariable", "SeungilSans")
        .replaceAll("Pretendard", "SeungilSans");
      value = unicode
        ? Buffer.from(renamed, "utf16le").swap16()
        : Buffer.from(renamed, "latin1");
    }
    header.writeUInt16BE(value.length, at + 8);
    header.writeUInt16BE(length, at + 10);
    strings.push(value);
    length += value.length;
  }
  name.data = Buffer.concat([header, ...strings]);
  const head = tables.find((table) => table.tag === "head");
  if (!head) throw new Error("Missing SFNT head table");
  head.data.writeUInt32BE(0, 8);
  const size =
    12 +
    count * 16 +
    tables.reduce(
      (sum, table) => sum + Math.ceil(table.data.length / 4) * 4,
      0,
    );
  const result = Buffer.alloc(size);
  font.copy(result, 0, 0, 12);
  let offset = 12 + count * 16;
  let headOffset;
  for (const [index, table] of tables.entries()) {
    const at = 12 + index * 16;
    result.write(table.tag, at, "ascii");
    result.writeUInt32BE(checksum(table.data), at + 4);
    result.writeUInt32BE(offset, at + 8);
    result.writeUInt32BE(table.data.length, at + 12);
    table.data.copy(result, offset);
    if (table.tag === "head") headOffset = offset;
    offset += Math.ceil(table.data.length / 4) * 4;
  }
  result.writeUInt32BE((0xb1b0afba - checksum(result)) >>> 0, headOffset + 8);
  return { font: result, nameIds: [...nameIds] };
}

function checksum(data) {
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
  data.copy(padded);
  let sum = 0;
  for (let at = 0; at < padded.length; at += 4)
    sum = (sum + padded.readUInt32BE(at)) >>> 0;
  return sum;
}

export function pageCharacters(html) {
  // ASCII supports dynamic dates, counters, keyboard shortcuts and input.
  // Keep all body text, including collapsed controls and templates. Code uses
  // the monospace stack; math uses KaTeX's own fonts, so neither needs this face.
  const text = [
    Array.from({ length: 95 }, (_, i) => String.fromCodePoint(i + 32)).join(""),
    "•–—‘’“”…↗✓−",
  ];
  function visit(node, inBody = false) {
    if (
      ["script", "style", "pre", "code", "svg", "math"].includes(node.tagName)
    )
      return;
    const classes =
      node.attrs?.find((attr) => attr.name === "class")?.value.split(/\s+/) ??
      [];
    if (classes.includes("katex")) return;
    inBody ||= node.tagName === "body";
    if (inBody && node.nodeName === "#text") text.push(node.value);
    for (const child of node.childNodes ?? []) visit(child, inBody);
    if (node.content) visit(node.content, inBody);
  }
  visit(parse(html));
  return [...new Set(text.join(""))]
    .filter((char) => char.codePointAt(0) >= 32)
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
    .join("");
}

export function unicodeRange(characters) {
  const codes = [
    ...new Set([...characters].map((char) => char.codePointAt(0))),
  ].sort((a, b) => a - b);
  const ranges = [];
  for (let i = 0; i < codes.length; i++) {
    const start = codes[i];
    let end = start;
    while (codes[i + 1] === end + 1) end = codes[++i];
    ranges.push(
      `U+${start.toString(16)}${end === start ? "" : `-${end.toString(16)}`}`,
    );
  }
  return ranges.join(",");
}

export function subsetMarkup(href, characters) {
  return `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin><style data-page-font>@font-face{font-family:"${SUBSET_FAMILY}";font-style:normal;font-weight:45 920;font-display:swap;src:url("${href}") format("woff2");unicode-range:${unicodeRange(characters)}}:root{--font-sans:"${SUBSET_FAMILY}","Pretendard Variable","Pretendard",ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"}</style>`;
}
