import { describe, expect, it } from "vitest";
import type { BlogPost } from "./content";
import { getNeighbors, getRelatedPosts, getSeries } from "./discovery";

function post(
  id: string,
  tags: string[] = [],
  date = "2024-01-01",
  draft = false,
): BlogPost {
  return {
    id,
    collection: "blog",
    data: { title: id, date: new Date(date), tags, draft },
  };
}

describe("related reading", () => {
  it("ranks a specific shared topic ahead of a newer broad match", () => {
    const current = post("current", ["cs", "db"]);
    const posts = [
      current,
      post("broad", ["cs"], "2025-01-01"),
      post("specific", ["db"], "2023-01-01"),
      post("both", ["cs", "db"], "2022-01-01"),
    ];
    expect(getRelatedPosts(current, posts).map((entry) => entry.id)).toEqual([
      "both",
      "specific",
      "broad",
    ]);
  });
  it("excludes the current post, drafts, navigation duplicates and unrelated content", () => {
    const current = post("current", ["os"]);
    const posts = [
      current,
      post("draft", ["os"], undefined, true),
      post("neighbor", ["os"]),
      post("other", ["job"]),
      post("related", ["os"]),
    ];
    expect(
      getRelatedPosts(current, posts, 3, ["neighbor"]).map((entry) => entry.id),
    ).toEqual(["related"]);
    expect(getRelatedPosts(post("untagged"), posts)).toEqual([]);
    expect(getRelatedPosts(current, posts, 0)).toEqual([]);
  });
  it("breaks ties deterministically and never mutates the collection", () => {
    const current = post("current", ["ps"]);
    const posts = [
      post("z", ["ps"]),
      post("a", ["ps"]),
      post("newest", ["ps"], "2025-01-01"),
    ];
    expect(getRelatedPosts(current, posts, 2).map((entry) => entry.id)).toEqual(
      ["newest", "a"],
    );
    expect(posts.map((entry) => entry.id)).toEqual(["z", "a", "newest"]);
  });
});

describe("series reading", () => {
  const chapter = (n: number, date: string) => ({
    ...post(`ostep-${n}`, ["cs", "os"], date),
    data: {
      title: `OSTEP ${n} Chapter`,
      date: new Date(date),
      tags: ["cs", "os"],
      draft: false,
    },
  });
  // Written out of order: chapter numbers, not dates, decide neighbours.
  const posts = [
    chapter(40, "2024-05-01"),
    chapter(17, "2024-04-01"),
    chapter(15, "2024-03-01"),
    chapter(16, "2024-02-01"),
    chapter(9, "2024-01-01"),
    post("unrelated", ["life"], "2024-02-15"),
  ];
  const current = posts[3];

  it("links the previous and next chapter", () => {
    const { previous, next } = getNeighbors(current, posts);
    expect(previous?.id).toBe("ostep-15");
    expect(next?.id).toBe("ostep-17");
  });

  it("recommends nearby chapters before topic matches", () => {
    expect(
      getRelatedPosts(current, posts, 3, ["ostep-15", "ostep-17"]).map(
        (entry) => entry.id,
      ),
    ).toEqual(["ostep-9", "ostep-40"]);
  });

  it("falls back to dates for posts outside a series", () => {
    const byDate = [...posts].sort(
      (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
    );
    const { previous, next } = getNeighbors(posts[5], byDate);
    expect(previous?.id).toBe("ostep-16");
    expect(next?.id).toBe("ostep-15");
  });

  it("does not treat problem numbers as chapters", () => {
    const problems = [
      "백준 1162번 도로포장",
      "백준 2261번 두 점",
      "백준 1번 A",
    ].map((title, index) => ({
      ...post(`p${index}`),
      data: { title, date: new Date(), tags: [], draft: false },
    }));
    expect(getSeries(problems[0], problems)).toEqual([]);
  });
});
