const TAG_ALIASES = new Map(
  Object.entries({
    backtracking: "backtracking",
    "bellman-ford": "bellman-ford",
    bfs: "graph",
    "binary-search": "binary-search",
    binary_search: "binary-search",
    bitmasking: "bitmasking",
    boj: "boj",
    "brute-force": "brute-force",
    bruteforce: "brute-force",
    bs: "binary-search",
    bst: "tree",
    "coordinate-compression": "data-structure",
    "counting-sort": "sort",
    cpp: "cpp",
    cs: "cs",
    db: "db",
    dev: "dev",
    dfs: "graph",
    dijkstra: "dijkstra",
    "disjoint-set": "union-find",
    disjointset: "union-find",
    dnc: "divide-and-conquer",
    dp: "dp",
    "euclidean-algorithm": "math",
    "eulerian-circuit": "graph",
    "eulers-phi-function": "math",
    express: "nodejs",
    floyd: "floyd",
    geometry: "geometry",
    graph: "graph",
    greedy: "greedy",
    hash: "hash",
    "hash-set": "hash",
    heap: "priority-queue",
    imos: "imos",
    java: "java",
    js: "js",
    kmp: "string",
    "lazy-propagation": "segment-tree",
    map: "hash",
    math: "math",
    "merge-sort": "sort",
    mst: "graph",
    nodejs: "nodejs",
    "prefix-sum": "prefix-sum",
    "priority-queue": "priority-queue",
    priorityqueue: "priority-queue",
    programmers: "programmers",
    ps: "ps",
    python: "python",
    "rabin-karp": "string",
    recursion: "divide-and-conquer",
    scc: "graph",
    "segment-tree": "segment-tree",
    set: "set",
    "sieve-of-eratosthenes": "math",
    simulation: "simulation",
    sort: "sort",
    "sparse-table": "data-structure",
    stack: "stack",
    string: "string",
    sweeping: "sweeping",
    "topology-sort": "graph",
    tree: "tree",
    trie: "trie",
    "union-find": "union-find",
    vue: "vue",
    vuejs: "vue",
  }),
);

export function toLowerKebabTag(tag) {
  return String(tag ?? "")
    .normalize("NFKC")
    .replace(/[’']/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeTag(tag) {
  const lowerKebab = toLowerKebabTag(tag);
  return TAG_ALIASES.get(lowerKebab) ?? lowerKebab;
}

export function normalizeTags(tags) {
  const normalized = [];
  const seen = new Set();

  for (const tag of tags ?? []) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag || seen.has(normalizedTag)) {
      continue;
    }

    normalized.push(normalizedTag);
    seen.add(normalizedTag);
  }

  return normalized;
}

export const TAG_FORMAT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
