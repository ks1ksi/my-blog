---
title: "백준 3482번 Labyrinth"
date: 2021-10-07
tags:
  - "graph"
  - "ps"
  - "python"
  - "tree"
---

[백준 3482번: Labyrinth](https://www.acmicpc.net/problem/3482)

## 아이디어
미궁에서 밧줄을 가장 길게 연결하는 방법을 구해야 한다. 즉 **"가장 멀리 떨어진 두 노드"**의 길이를 구하면 된다. 어떻게 구하면 좋을까?

문제에 **"The labyrinth is designed in such a way that there is exactly one path between any two free blocks.** Consequently, if we find the proper hooks to connect, it is easy to find the right path connecting them." 라고 써있다.

미궁은 전체가 이어져 있으며 두 노드를 있는 유일한 경로가 존재한다. 트리 문제다. 어제 풀었던 [트리의 지름](/blog/백준-1167번-트리의-지름) 문제를 응용해서 풀 수 있다. 0과 1로 표현된 미로라 bfs로 풀었다.

## 코드
```python
import sys
import copy
from collections import deque
input = sys.stdin.readline

dy = [0, 0, 1, -1]
dx = [1, -1, 0, 0]

def bfs(start, graph, C, R):
    m = (1, -1, -1)
    q = deque()
    q.append(start)
    graph[start[0]][start[1]] = 1
    while q:
        y, x = q.popleft()
        for i in range(4):
            ny = y + dy[i]
            nx = x + dx[i]
            if ny >= R or nx >= C or ny < 0 or nx < 0:
                continue
            elif graph[ny][nx] > 0:
                continue
            else:
                graph[ny][nx] = graph[y][x] + 1
                if graph[ny][nx] > m[0]:
                    m = (graph[ny][nx], ny, nx)
                q.append((ny, nx))
    return m

T = int(input())
while T > 0:
    labyrinth = []
    start = None
    C, R = map(int, input().split())
    for i in range(R):
        lst = []
        t = input().rstrip()
        for j in range(C):
            if t[j] == '#':
                lst.append(1)
            elif t[j] == '.':
                lst.append(0)
                if not start:
                    start = (i, j)
        labyrinth.append(lst)

    res1 = bfs(start, copy.deepcopy(labyrinth), C, R)
    res2 = bfs((res1[1], res1[2]), copy.deepcopy(labyrinth), C, R)
    print(f"Maximum rope length is {res2[0] - 1}.")

    T -= 1
```
![[백준 3482번 Labyrinth-1-3e2839dd71.png]]

## 여담
> 처음으로 영어 문제를 풀어봤다. 사실 번역기 돌렸다.
골드3달성 ㄷㄷ
