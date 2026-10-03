import { describe, expect, it } from "vitest";
import { formatDate, formatLongDate, getSiteYear } from "./dates";
import { readingTime } from "./utils";

describe("Korean site dates", () => {
  it("uses the same KST date and year across UTC year boundaries", () => {
    const newYear = new Date("2025-12-31T15:00:00.000Z");
    expect(getSiteYear(newYear)).toBe("2026");
    expect(formatDate(newYear)).toBe("2026년 1월 1일");
    expect(formatLongDate(newYear)).toBe("2026년 1월 1일");
    expect(getSiteYear(new Date("2025-12-31T14:59:59.999Z"))).toBe("2025");
  });

  it("retains the calendar day of date-only frontmatter", () => {
    expect(formatDate(new Date("2024-02-29"))).toBe("2024년 2월 29일");
  });
});

describe("reading time", () => {
  it("uses a Korean label and a minimum of one minute", () => {
    expect(readingTime("")).toBe("1분 읽기");
    expect(readingTime("단어 ".repeat(201))).toBe("2분 읽기");
  });

  it("does not count embedded images or fenced code as prose", () => {
    expect(
      readingTime("```ts\n" + "code ".repeat(600) + "\n```\n![[image.png]]"),
    ).toBe("1분 읽기");
  });
});
