---
title: "백준 19608번 Searching for Strings"
date: 2022-06-07
tags:
  - "string"
  - "cpp"
  - "ps"
---

[백준 19608번: Searching for Strings](https://www.acmicpc.net/problem/19608)

## 아이디어

모든 permutation에 대해 해시를 계산할 순 없고 그냥 알파벳 개수만 세서 a~z 개수가 같고, 해시값이 us에 없으면 집어넣는다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;
using ll = long long;

const int MAX = 200005;
const ll MOD1 = 1e9+9;
const ll MOD2 = 1e8+7;
const ll BASE = 31;

ll p1 = 1, p2 = 1;
int nd[26], hs[26];

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    string N, H;
    cin >> N >> H;

    if (N.size() > H.size()) {
        cout << 0;
        return 0;
    }

    for (int i = 1; i < N.size(); i++) {
        p1 = p1*BASE%MOD1;
        p2 = p2*BASE%MOD2;
    }

    for (char c : N) {
        nd[c-'a']++;
    }

    ll h1 = 0, h2 = 0;
    ll ans = 0;
    unordered_set<ll> us;
    for (int i = 0; i <= H.size()-N.size(); i++) {
        if (i == 0) {
            for (int j = 0; j < N.size(); j++) {
                h1 = (h1*BASE+H[j])%MOD1;
                h2 = (h2*BASE+H[j])%MOD2;
                hs[H[j]-'a']++;
            }
        }
        else {
            h1 = h1-p1*H[i-1]%MOD1+MOD1;
            h2 = h2-p2*H[i-1]%MOD2+MOD2;
            hs[H[i-1]-'a']--;
            h1 = (h1*BASE+H[i-1+N.size()])%MOD1;
            h2 = (h2*BASE+H[i-1+N.size()])%MOD2;
            hs[H[i-1+N.size()]-'a']++;
        }

        bool chk = true;
        for (int j = 0; j < 26; j++) {
            if (nd[j] != hs[j]) {
                chk = false;
                break;
            }
        }
        ll key = (h1<<32)|h2;
        if (chk && us.find(key) == us.end()) {
            // cout << i << ' ' << h1 << ' ' << h2 << ' ' << key <<'\n';
            us.insert(key);
            ans++;
        }
    }

    cout << ans;

    return 0;
}
```

![[백준 19608번 Searching for Strings-1-170ffdc3af.png]]


## 여담
> 이게 P4?..
