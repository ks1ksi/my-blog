---
title: "백준 6206번 Milk Patterns"
date: 2022-06-04
tags:
  - "string"
  - "cpp"
  - "ps"
---

[백준 6206번: Milk Patterns](https://www.acmicpc.net/problem/6206)

## 아이디어
char이 아니라 int를 쓰고, 해싱 충돌했을 경우 완전히 일치하는 개수를 세서 k-1개 이상인 경우 답을 갱신한다.

## 코드

```cpp
#include <bits/stdc++.h>

using namespace std;
using ll = long long;

const int MOD = 100003;
const int MAX = 20000;
int pow2[MAX+1];
vector<int> v;

int hashing(int idx, int sz) {
    int ret = 0;
    for (int i = 0; i < sz; i++) {
        ret *= 2;
        ret %= MOD;
        ret += v[idx+i];
    }
    return ret % MOD;
}

bool cmp(int i, int j, int sz) {
    bool flag = true;
    for (int k = 0; k < sz; k++) {
        if (v[i+k] != v[j+k]) {
            flag = false;
            break;
        }
    }
    return flag;
}

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    int n, k;
    cin >> n >> k;
    v.resize(n);
    for (int i = 0; i < n; i++) {
        cin >> v[i];
    }

    pow2[0] = 1;
    for (int i = 1; i < n; i++) {
        pow2[i] = pow2[i-1]*2%MOD;
    }

    int ans = 0;
    int lo = 1, hi = n-1;
    while (lo <= hi) {
        bool found = false;
        vector<int> table[100003];
        int sz = (lo + hi)/2;
        int h = hashing(0, sz);

        for (int i = 0; i <= n-sz; i++) {
            if (found) break;
            if (i != 0) {
                h = (h - v[i-1]*pow2[sz-1]%MOD + MOD)*2%MOD;
                h = (h + v[i+sz-1])%MOD;
            }
            if (table[h].size() > 0) {
                int cnt = 0;
                for (int pos : table[h]) {
                    if (cmp(i, pos, sz)) {
                        cnt++;
                    }
                }
                if (cnt >= k-1) {
                    ans = max(ans, sz);
                    found = true;
                    break;
                }
            }
            table[h].push_back(i);
        }
        if (found) lo = sz+1;
        else hi = sz-1;
    }

    cout << ans;

    return 0;
}
```

![[백준 6206번 Milk Patterns-1-b41218d114.jpeg]]

## 여담
> 라빈카프 넘 어렵다
