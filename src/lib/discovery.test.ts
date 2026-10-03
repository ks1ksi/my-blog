import { describe, expect, it } from "vitest";
import type { BlogPost } from "./content";
import { getRelatedPosts } from "./discovery";

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
