---
title: "백준 5467번 Type Printer"
date: 2022-04-25
tags:
  - "trie"
  - "cpp"
  - "ps"
---

[백준 5467번: Type Printer](https://www.acmicpc.net/problem/5467)

## 아이디어

Trie를 구성하고 재귀적으로 깊이가 얕은 글자부터 출력한다.

## 코드
```cpp
#include <bits/stdc++.h>

using namespace std;

struct Trie {
    Trie* child[26];
    bool end;
    int max_depth;

    Trie() {
        memset(child, 0, sizeof(child));
        end = false;
        max_depth = 0;
    }

    ~Trie() {
        for (int i = 0; i < 26; i++) {
            if (child[i]) delete child[i];
        }
    }

    void insert(string& s, int idx) {
        max_depth = max(max_depth, (int)s.length()-idx);
        if (idx == s.length()) {
            end = true;
            return;
        }
        if (!child[s[idx]-'a']) child[s[idx]-'a'] = new Trie();
        child[s[idx]-'a']->insert(s, idx+1);
    }
};

vector<char> ans;

void solve(Trie* node) {
    if (node->end) ans.push_back('P');
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>> >pq;
    for (int i = 0; i < 26; i++) {
        if (node->child[i]) {
            pq.push({node->child[i]->max_depth, i});
        }
    }
    while (!pq.empty()) {
        ans.push_back((char)(pq.top().second+'a'));
        solve(node->child[pq.top().second]);
        pq.pop();
    }
    ans.push_back('-');
}

int main() {
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    Trie root;
    vector<string> v;
    int n;
    cin >> n;
    while (n--) {
        string s;
        cin >> s;
        root.insert(s, 0);
    }
    solve(&root);
    while (ans.back() == '-') ans.pop_back();
    cout << ans.size() << '\n';
    for (auto& c : ans) {
        cout << c << '\n';
    }
    return 0;
}
```

![[백준 5467번 Type Printer-1-674b21e988.png]]


## 여담
> 마지막에 최대한 긴 단어를 치고 지우지 않고 끝내야 한다.
영어 울렁증 있어서 Papago 돌림.
