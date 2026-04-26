---
title: "백준 9663번 N-Queen"
date: 2021-07-15
tags:
  - "backtracking"
  - "ps"
  - "python"
  - "divide-and-conquer"
---

[백준 9663번: N-Queen](https://www.acmicpc.net/problem/9663)

![[백준 9663번 N-Queen-1-23f3b3e631.png]]

## 아이디어

백트래킹 문제다. **"서로 공격할 수 없도록"** 퀸을 배치해야 한다. 어떤 경우에 서로 공격할 수 있을까?

1. 같은 행, 같은 열에 위치할 때.
2. 대각선 방향에 위치할 때.

1번 조건은 걸러내기 매우 쉽다. 그냥 같은 행, 같은 열 슥~ 하고 탐색해서 뭐가 있으면 넘기면 된다.
그렇다면 2번 조건은? -(N - 1) 부터 (N - 1)까지 하나씩 놓여있는 퀸의 좌표에서 더하거나 빼면서 대각선에 뭐가 있나 확인했다. 그렇게 만들어진 _~~쓰레기~~_ 코드는 다음과 같다.

```python
import sys
input = sys.stdin.readline

N = int(input())

chessBoard = [[0]*N for _ in range(N)]
count = 0
queenList = []


def checkSafe(row, col):
    for i in queenList:
        if i[0] == row or i[1] == col:
            return False
        for j in range(-N + 1, N):
            if (i[0] + j == row and i[1] - j == col) or (i[0] + j == row and i[1] + j == col):
                return False
    return True


def solve(queenList):
    if len(queenList) == N:
        global count
        count += 1
        return

    rowStart = 0
    if queenList:
        rowStart = queenList[-1][0] + 1

    for i in range(rowStart, N):
        for j in range(N):
            if checkSafe(i, j):
                queenList.append([i, j])
                solve(queenList)
                queenList.pop()


solve(queenList)
print(count)
```
![[백준 9663번 N-Queen-2-9b90abc8b8.png]]

2차원 리스트에 퀸을 하나씩 놓으면서 공격 범위를 체크하는 방식으로는 시간 내에 **절대** 풀 수 없었다. 이틀 내내 좌절하면서 어떻게 풀면 좋을지 생각했는데 누가 1차원 리스트를 쓰면 된다고 했다. 아니 체스판을 어떻게 1차원 배열으로 나타내라는거지? 가능했다. **행과 열이 겹칠 일이 없기 때문에!**

		rowList = [-1]*N # 인덱스 = column, 값 = row
리스트를 선언한다. 이 때 이 리스트의 인덱스는 각각의 열을 나타내고, 해당 인덱스에 들어있는 값은 행을 나타낸다. 예를 들어 3번째 인덱스에 4가 들어가 있으면 **"4행 3열 (4, 3)"** 에 퀸이 놓여 있는 것이다.

이제 행과 열이 겹치는 경우를 걸러내기 매우 편해졌다. 왜? 리스트에 -1이 저장된 경우 지금까지 한 번도 사용하지 않은 열이기 때문에 퀸을 놓을 수 있다. 행은 0부터 N - 1까지 함수의 argument로 전달할 것이다.

대각선 범위 체크도 매우 편해졌다. **이미 놓여있는 퀸의 열(인덱스)과 내가 놓으려고 하는 위치의 열과의 차이 == 이미 놓여있는 퀸의 행과 내가 놓으려고 하는 위치의 행과의 차이** -> 대각선에 위치한 것이다.

## 코드
```python
import sys
input = sys.stdin.readline

N = int(input())

rowList = [-1]*N # 인덱스 = column, 값 = row
count = 0

def checkSafe(idx, row):
    for i in range(N):
        if i == idx or rowList[i] == -1:
            continue
        if abs(idx - i) == abs(rowList[i] - row):
            return False
    return True


def solve(currentRow):
    if currentRow == N: # N개 다 채움
        global count
        count += 1
        return

    for i in range(N):
        if rowList[i] != -1: # 이미 사용중인 column
            continue
        if checkSafe(i, currentRow):
            rowList[i] = currentRow
            solve(currentRow + 1) # 다음 row
            rowList[i] = -1

solve(0)
print(count)

```
![[백준 9663번 N-Queen-3-fb34e887f1.png]]

## 여담
골드찍고 너무 해이해졌다. 마음을 다잡아야겠다.
>생활관에 누워서 유튜브좀 그만봐 제발 !!!!
