---
title: "백준 1005번 ACM Craft"
date: 2022-02-03
tags:
  - "graph"
  - "cpp"
  - "ps"
---

[백준 1005번: ACM Craft](https://www.acmicpc.net/problem/1005)

## 아이디어

게임 개발 문제랑 똑같다. w에 대해서만 출력하면 된다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;

constexpr int MAX = 1001;

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    int t;
    cin >> t;
    while (t--) {
        int n, m, cost[MAX], tc[MAX], indegree[MAX] = {0};
        cin >> n >> m;
        vector<vector<int>> adj(n+1);
        queue<int> q;
        vector<int> ans;
        for (int i = 1; i < n+1; i++) {
            cin >> cost[i];
            tc[i] = cost[i];
        }
        while (m--) {
            int a, b;
            cin >> a >> b;
            adj[a].push_back(b);
            indegree[b]++;
        }
        for (int i = 1; i < n+1; i++) {
            if (!indegree[i]) q.push(i);
        }
        while (!q.empty()) {
            int cur = q.front();
            q.pop();
            ans.push_back(cur);
            for (int next : adj[cur]) {
                if (!(--indegree[next])) q.push(next);
            }
        }
        for (int x : ans) {
            for (int n : adj[x]) {
                tc[n] = max(tc[n], tc[x]+cost[n]);
            }
        }
        int w;
        cin >> w;
        cout << tc[w] << '\n';
    }

    return 0;
}
```

![[백준 1005번 ACM Craft-1-246d9885f4.jpeg]]

## 여담
> 맨날 전역 배열만 쓰다보니 초기화하는걸 까먹음.
