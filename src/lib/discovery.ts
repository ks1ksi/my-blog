import type { BlogPost } from "./content";

export const FEATURED_POST_IDS = [
  "real-mysql-80-8장-인덱스",
  "ostep-04-process",
  "그래프-최단경로-알고리즘-정리",
  "토스-3년-이하-server-developer-challenge-지원-및-합격-후기",
] as const;

type SeriesGroup = {
  title: string;
  description: string;
  postIds: readonly string[];
};

export type SeriesDefinition = {
  id: string;
  title: string;
  description: string;
  introduction: string;
  groups: SeriesGroup[];
};

export const SERIES: SeriesDefinition[] = [
  {
    id: "ostep",
    title: "OSTEP 운영체제",
    description:
      "프로세스부터 파일 시스템까지, 운영체제 학습 노트를 교재 순서대로 읽습니다.",
    introduction:
      "Operating Systems: Three Easy Pieces를 읽고 정리한 글입니다. 프로세스와 CPU 가상화, 메모리, 동시성, 영속성의 순서로 묶었습니다. 아래에는 블로그에 공개된 장만 표시하며, 번호는 교재의 장 번호를 따릅니다.",
    groups: [
      {
        title: "교재와 참고 자료",
        description: "원서와 한국어 번역, 강의 자료를 먼저 확인할 수 있습니다.",
        postIds: ["ostep-교재"],
      },
      {
        title: "프로세스와 CPU 가상화",
        description:
          "프로세스의 상태와 API에서 시작해 실행 제어와 여러 스케줄링 정책을 살펴봅니다.",
        postIds: [
          "ostep-04-process",
          "ostep-05-process-api",
          "ostep-06-direct-execution",
          "ostep-07-cpu-scheduling",
          "ostep-08-multi-level-feedback-queue-mlfq",
          "ostep-09-lottery-scheduling",
          "ostep-10-multi-cpu-scheduling",
        ],
      },
      {
        title: "메모리 가상화",
        description:
          "주소 공간과 메모리 API를 바탕으로 주소 변환, 페이징, TLB와 스와핑을 이어서 읽습니다.",
        postIds: [
          "ostep-13-address-spaces",
          "ostep-14-memory-api",
          "ostep-15-address-translation",
          "ostep-16-segmentation",
          "ostep-17-free-space-management",
          "ostep-18-introduction-to-paging",
          "ostep-19-translation-lookaside-buffer",
          "ostep-20-advanced-page-tables",
          "ostep-21-swapping-mechanisms",
          "ostep-22-swapping-policies",
        ],
      },
      {
        title: "동시성",
        description:
          "스레드와 락, 조건 변수와 세마포어를 정리하고 동시성 오류와 이벤트 기반 처리로 넘어갑니다.",
        postIds: [
          "ostep-26-concurrency-and-threads",
          "ostep-27-thread-api",
          "ostep-28-locks",
          "ostep-29-locked-data-structures",
          "ostep-30-condition-variables",
          "ostep-31-semaphores",
          "ostep-32-concurrency-bugs",
          "ostep-33-event-based-concurrency",
        ],
      },
      {
        title: "영속성과 저장장치",
        description:
          "입출력 장치, 하드 디스크와 RAID를 거쳐 파일 시스템의 구현을 살펴봅니다.",
        postIds: [
          "ostep-36-io-devices",
          "ostep-37-hard-disk-drives",
          "ostep-38-redundant-disk-arrays-raid",
          "ostep-40-file-system-implementation",
        ],
      },
    ],
  },
  {
    id: "real-mysql",
    title: "Real MySQL 8.0",
    description:
      "인덱스와 옵티마이저, 공개된 두 장의 정리를 순서대로 읽습니다.",
    introduction:
      "Real MySQL 8.0을 읽고 정리한 8장과 9장입니다. 먼저 데이터에 접근하는 인덱스의 구조와 비용을 살펴보고, 이어서 옵티마이저가 쿼리 실행 계획을 선택하는 과정을 읽을 수 있습니다.",
    groups: [
      {
        title: "8장 · 인덱스",
        description:
          "디스크 I/O와 B-Tree에서 출발해 인덱스 스캔, 다중 칼럼 인덱스와 클러스터링 인덱스를 정리합니다.",
        postIds: ["real-mysql-80-8장-인덱스"],
      },
      {
        title: "9장 · 옵티마이저와 힌트",
        description:
          "쿼리 실행 절차와 비용 기반 최적화를 바탕으로 정렬, 조인, DISTINCT와 임시 테이블 처리를 살펴봅니다.",
        postIds: ["real-mysql-80-9장-옵티마이저와-힌트"],
      },
    ],
  },
];

export function getFeaturedPosts(posts: readonly BlogPost[]) {
  const byId = new Map(
    posts.filter((post) => !post.data.draft).map((post) => [post.id, post]),
  );
  return FEATURED_POST_IDS.flatMap((id) => {
    const post = byId.get(id);
    return post ? [post] : [];
  });
}

export function getSeriesWithPosts(posts: readonly BlogPost[]) {
  const byId = new Map(
    posts.filter((post) => !post.data.draft).map((post) => [post.id, post]),
  );
  return SERIES.map((series) => {
    const groups = series.groups
      .map((group) => ({
        ...group,
        posts: group.postIds.flatMap((id) => {
          const post = byId.get(id);
          return post ? [post] : [];
        }),
      }))
      .filter((group) => group.posts.length > 0);
    return { ...series, groups, posts: groups.flatMap((group) => group.posts) };
  }).filter((series) => series.posts.length > 0);
}

export type PostSeries = ReturnType<typeof getSeriesWithPosts>[number];

export function getSeriesNavigation(
  postId: string,
  posts: readonly BlogPost[],
) {
  const series = getSeriesWithPosts(posts).find((entry) =>
    entry.posts.some((post) => post.id === postId),
  );
  if (!series) return undefined;
  const index = series.posts.findIndex((post) => post.id === postId);
  return {
    series,
    position: index + 1,
    previous: series.posts[index - 1],
    next: series.posts[index + 1],
  };
}

export function getRelatedPosts(
  post: BlogPost,
  posts: readonly BlogPost[],
  limit = 3,
  excludeIds: readonly string[] = [],
) {
  const excluded = new Set([post.id, ...excludeIds]);
  const tags = new Set(post.data.tags ?? []);
  const broadTags = new Set(["cs", "ps", "life", "job"]);
  return posts
    .filter((candidate) => !candidate.data.draft && !excluded.has(candidate.id))
    .map((candidate) => ({
      post: candidate,
      score: [...new Set(candidate.data.tags ?? [])].reduce(
        (score, tag) =>
          score + (tags.has(tag) ? (broadTags.has(tag) ? 1 : 3) : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.data.date.valueOf() - a.post.data.date.valueOf() ||
        a.post.id.localeCompare(b.post.id, "ko-KR"),
    )
    .slice(0, Math.max(0, limit))
    .map(({ post: candidate }) => candidate);
}

export function validateDiscoveryReferences(posts: readonly BlogPost[]) {
  const published = new Set(
    posts.filter((post) => !post.data.draft).map((post) => post.id),
  );
  const errors: string[] = [];
  for (const [name, ids] of [
    ["대표 글", FEATURED_POST_IDS],
    ...SERIES.map(
      (series) =>
        [series.id, series.groups.flatMap((group) => group.postIds)] as const,
    ),
  ] as const) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${name}: duplicate post ${id}`);
      if (!published.has(id))
        errors.push(`${name}: unpublished or missing post ${id}`);
      seen.add(id);
    }
  }
  return errors;
}
