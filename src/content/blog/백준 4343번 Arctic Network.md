---
title: "백준 4343번 Arctic Network"
date: 2022-02-01
tags:
  - "graph"
  - "cpp"
  - "ps"
---

[백준 4343번: Arctic Network](https://www.acmicpc.net/problem/4343)

## 아이디어

Satellite Channel을 제외하고 MST를 만들면 된다. 마지막으로 뽑은 간선의 비용을 출력한다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;

constexpr int MAX = 501;
int N, M, T;
int p[MAX];

int find(int n) {
    if (p[n] < 0) return n;
    return p[n] = find(p[n]);
}

void merge(int n1, int n2) {
    n1 = find(n1);
    n2 = find(n2);
    if (n1 == n2) return;
    p[n1] += p[n2];
    p[n2] = n1;
}

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

	cout << fixed << setprecision(2);

    cin >> T;
    while (T--) {
        cin >> N >> M;
        vector<pair<int, int>> v;
        vector<pair<int, pair<int, int>>> e;
        for (int i = 0; i < M; i++) {
            int a, b;
            cin >> a >> b;
            v.push_back({a, b});
        }

        for (int i = 0; i < M; i++) {
            for (int j = 0; j < M; j++) {
                if (i == j) continue;
                e.push_back({pow(v[i].first-v[j].first, 2)+pow(v[i].second-v[j].second, 2), {i, j}});
            }
        }

        sort(e.begin(), e.end());
        memset(p, -1, sizeof(p));
        int cnt = 0;
        for (auto p : e) {
            int c = p.first;
            int a = p.second.first;
            int b = p.second.second;
            if (find(a) == find(b)) continue;
            cnt++;
            merge(a, b);
            if (cnt == M-N) {
                cout << sqrt((double)c) << '\n';
                break;
            }
        }
    }

    return 0;
}
```

![[백준 4343번 Arctic Network-1-075d39baa5.jpeg]]

## 여담
> 문제 해석이 제일 어렵다.
```cpp
cout << fixed << setprecision(2);
```
Memo..
