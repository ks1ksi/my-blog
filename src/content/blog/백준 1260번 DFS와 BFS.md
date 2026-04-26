---
title: "백준 1260번 DFS와 BFS"
date: 2021-05-21
tags:
  - "graph"
  - "ps"
  - "python"
---

[백준 1260번: DFS와 BFS](https://www.acmicpc.net/problem/1260)

## 아이디어
DFS는 재귀함수로, BFS는 파이썬 collections의 deque로 구현했다.

## 코드
```python
from collections import deque

def dfs(graph, v, visited):
    visited[v] = True
    print(v, end = ' ')
    for i in graph[v]:
        if (visited[i] is False):
            visited[i] = True
            dfs(graph, i, visited)


def bfs(graph, v, deq, visited):
    visited[v] = True
    print(v, end = ' ')
    while True:
        for i in graph[v]:
            if visited[i] is False:
                print(i, end = ' ')
                visited[i] = True
                deq.append(i)
        if deq:
            v = deq.popleft()
        else:
            break


N, M, V = map(int, input().split())
graph = [[]for _ in range(N + 1)]
visited = [True] + [False] * N
deq = deque()

for i in range(M):
    A, B = map(int, input().split())
    graph[A].append(B)
    graph[B].append(A)
for i in graph:
    i.sort()

dfs(graph, V, visited)
print()
visited = [True] + [False] * N
bfs(graph, V, deq, visited)

```

![[백준 1260번 DFS와 BFS-1-e1cb7d84fa.png]]

## 여담
인터넷 검색 한번도 안하고 구현해서 기분이 상당히 좋다.
