---
title: "백준 1011번 Fly me to the Alpha Centauri"
date: 2021-09-26
tags:
  - "ps"
  - "python"
---

[백준 1011번: Fly me to the Alpha Centauri](https://www.acmicpc.net/problem/1011)

## 아이디어
수학 문제다. 1 121 12321 1234321 각각 1, 4, 9, 16… 모두 제곱수다. 제곱수를 기준으로 대칭이 된다. 9는 5칸, 10, 11, 12는 12321에 1, 2, 3을 하나씩 추가하면 되니까 6칸, 13, 14, 15는 123321에 1, 2, 3을 하나씩 추가하면 되니까 7칸이다. 제곱수 사이에 있는 짝수 개의 수을 절반으로 나누면 각각 같은 칸을 움직인다.

## 코드
```python
import sys
import math
input = sys.stdin.readline

def solve(n):
    v = math.sqrt(n)

    s = math.floor(v)
    e = s + 1
    ans = 2 * s - 1

    if n == s ** 2:
        pass
    elif n - s**2 <= (e**2 - s**2) // 2:
        ans += 1
    else:
        ans += 2

    print(ans)

T = int(input())
for _ in range(T):
    x, y = map(int, input().split())
    dist = y - x
    solve(dist)
```

![[백준 1011번 Fly me to the Alpha Centauri-1-8d5591c938.png]]

## 여담
>대학교 1학년때 풀다 어려워서 도망간 문제다. 이걸 왜 못풀었지?
