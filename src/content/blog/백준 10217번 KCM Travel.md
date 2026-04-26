---
title: "백준 10217번 KCM Travel"
date: 2022-01-22
tags:
  - "cpp"
  - "dijkstra"
  - "ps"
---

[백준 10217번: KCM Travel](https://www.acmicpc.net/problem/10217)

## 아이디어

도로포장 문제랑 비슷하다. cost 상태를 정의하고 소요 시간을 기록한다.
튜플 쓰기 넘 불편하다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;

typedef struct _Data {
    int cur;
    int cost;
    int time;
    bool operator< (const _Data& d) const {
        return time > d.time;
    }
} Data;

constexpr int MAX = 101, MAX_COST = 10001;
int dist[MAX][MAX_COST];

int dijkstra(int n, int m, vector<vector<tuple<int, int, int>>>& adj) {
    priority_queue<Data> pq;
    dist[1][0] = 0;
    pq.push({1, 0, 0});
    while (!pq.empty()) {
        Data d = pq.top();
        pq.pop();
        if (dist[d.cur][d.cost] < d.time) continue;
        for (auto t : adj[d.cur]) {
            int next = get<0>(t);
            int nc = get<1>(t);
            int nt = get<2>(t);

            if (d.cost+nc > m) continue;
            if (dist[next][d.cost+nc] > d.time+nt) {
                dist[next][d.cost+nc] = d.time+nt;
                pq.push({next, d.cost+nc, d.time+nt});
            }
        }
    }
    int ret = INT_MAX;
    for (int i = 0; i <= m; i++) {
        ret = min(ret, dist[n][i]);
    }
    return ret;
}

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    int t;
    cin >> t;
    while (t--) {
        int n, m, k;
        cin >> n >> m >> k;
        vector<vector<tuple<int, int, int>>> adj(n+1);
        while (k--) {
            int u, v, c, d;
            cin >> u >> v >> c >> d;
            adj[u].push_back({v, c, d});
        }
        fill(&dist[0][0], &dist[MAX-1][MAX_COST], INT_MAX);
        int ans = dijkstra(n, m , adj);
        if (ans == INT_MAX) cout << "Poor KCM\n";
        else cout << ans << '\n';
    }

    return 0;
}
```

![[백준 10217번 KCM Travel-1-03054a6a2a.jpeg]]

## 여담
> 왜 5초나 걸렸을까?
DP로 풀면 더 빨라질지도?
