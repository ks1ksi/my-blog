---
title: "백준 15422번 Bumped!"
date: 2022-01-16
tags:
  - "cpp"
  - "dijkstra"
  - "ps"
---

[백준 15422번: Bumped!](https://www.acmicpc.net/problem/15422)

## 아이디어

도로는 무방향, 비행기 티켓은 방향 간선임에 주의.
똑같은 그래프 두 개(g1, g2) 만들고, 각각 주어진 도로 입력대로 연결해준다.
그리고 비행기 티켓 입력대로 g1의 u번 도시와 g2의 v번 도시를 연결해준다. 이 때 cost는 0이다.
그리도 다익스트라 돌려주면 끝!
도시가 5만개, cost도 최대 5만이기 때문에 총 합이 int범위를 벗어남에 주의하자.

그래프 두개를 편하게 만들기 위해 두 번째 그래프는 50000번째 node부터 시작하도록 했다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;

#define int long long

constexpr int MAX = 50000;
constexpr long long INF = LLONG_MAX;
int N, M, F, S, T; // city, road, flight, start, dest
vector<pair<int, int>> adj[2*MAX];
bool visited[2*MAX];
int dist[2*MAX];

void dijkstra() {
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
    for (int i = 0; i < N; i++) {
        dist[i] = INF;
    }
    for (int i = MAX; i < MAX+N; i++) {
        dist[i] = INF;
    }
    dist[S] = 0;
    pq.push({0, S});
    while (!pq.empty()) {
        int cost = pq.top().first;
        int cur = pq.top().second;
        pq.pop();
        if (visited[cur]) continue;
        visited[cur] = true;
        for (auto p : adj[cur]) {
            int next = p.first;
            int nc = p.second;
            if (dist[next] > dist[cur]+nc) {
                dist[next] = dist[cur]+nc;
                pq.push({cost+nc, next});
            }
        }
    }
}

signed main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    cin >> N >> M >> F >> S >> T;
    for (int i = 0; i < M; i++) {
        int a, b, c;
        cin >> a >> b >> c;
        adj[a].push_back({b, c});
        adj[b].push_back({a, c});
        adj[a+MAX].push_back({b+MAX, c});
        adj[b+MAX].push_back({a+MAX, c});
    }
    for (int i = 0; i < F; i++) {
        int u, v;
        cin >> u >> v;
        adj[u].push_back({v+MAX, 0});
    }
    dijkstra();
    cout << min(dist[T], dist[T+MAX]);
    return 0;
}
```

![[백준 15422번 Bumped!-1-8d951ae975.jpeg]]

## 여담
> 이거 약간 bfs응용 문제들 느낌이다. 벽을 몇 번 뚫었는지 state에 따라 그래프 층이 달라지는 벽 뚫고 이동하기 문제처럼 생각하면 풀 수 있다.
