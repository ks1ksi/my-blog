---
title: "[Express] Error Handling"
date: 2021-08-16
tags:
  - "nodejs"
  - "js"
---

## 무식한 에러 핸들링

각 router마다 하나하나 try-catch로 감싸준다.

```js
app.get("/User", async function (req, res) {
  let users
  try {
    users = await db.collection("User").find().toArray()
  } catch (error) {
    res.status(500).json({ error: error.toString() })
  }
  res.json({ users })
})
```
내가 작성한 모든 코드에 try-catch문을 적용하는 것은 상당히 귀찮고 비효율적인 일이다. 만약 HTTP Status Code를 500이 아닌 503으로 변경해야 한다면? 작성한 코드를 전부 수정해야 한다.

## Error Handling Middleware 정의
**err, req, res, next** 이렇게 4개의 인자를 가지고 있는 미들웨어는 에러 핸들링 미들웨어이다.

```js
const app = require('express')();

app.get('*', function(req, res, next) {
  // This middleware throws an error, so Express will go straight to
  // the next error handler
  throw new Error('woops');
});

app.get('*', function(req, res, next) {
  // This middleware is not an error handler (only 3 arguments),
  // Express will skip it because there was an error in the previous
  // middleware
  console.log('this will not print');
});

app.use(function(error, req, res, next) {
  // Any request to this server will get here, and will send an HTTP
  // response with the error message 'woops'
  res.json({ message: error.message });
});

app.listen(3000);
```

첫 번째 라우터가 에러를 던지면, 마지막에 작성한 에러 핸들링 미들웨어까지 내려가서 오류를 처리한다. 에러 핸들링 미들웨어는 **반드시 마지막에 작성**해야 한다.

## Async?

**비동기로 발생하는 오류는 다음과 같이 next()를 통해 에러 핸들링 미들웨어로 넘겨야 한다.** 그냥 throw 해버리면 에러 핸들링 미들웨어까지 도달하지 못한다.

```js
const app = require('express')();

app.get('*', function(req, res, next) {
  // Reporting async errors *must* go through `next()`
  setImmediate(() => { next(new Error('woops')); });
});

app.use(function(error, req, res, next) {
  // Will get here
  res.json({ message: error.message });
});

app.listen(3000);
```

헬퍼 함수를 사용하여 코드를 좀 더 간결하게 작성할 수 있다.

```js
function wrapAsync(fn) {
  return function(req, res, next) {
    // Make sure to `.catch()` any errors and pass them along to the `next()`
    // middleware in the chain, in this case the error handler.
    fn(req, res, next).catch(next);
  };
}
```

프로미스를 반환하는 fn 함수에서** rejection이 발생하면 catch에서 next() 즉 에러 핸들링 미들웨어로 넘겨버린다. **

```js
const app = require('express')();

app.get('*', wrapAsync(async function(req, res) {
  await new Promise(resolve => setTimeout(() => resolve(), 50));
  // Async error!
  throw new Error('woops');
}));

app.use(function(error, req, res, next) {
  // Gets called because of `wrapAsync()`
  res.json({ message: error.message });
});

app.listen(3000);

function wrapAsync(fn) {
  return function(req, res, next) {
    // Make sure to `.catch()` any errors and pass them along to the `next()`
    // middleware in the chain, in this case the error handler.
    fn(req, res, next).catch(next);
  };
}
```

wrapAsync로 감싼 모습이다. 비동기 에러가 발생하면 catch->next를 거쳐 사전에 정의한 에러 핸들링 미들웨어로 에러가 넘어간다. 이 때 error의 종류에 따라 다른 메세지를 건네주는 등 간결한 코드 작성이 가능해진다.

[출처: http://thecodebarbarian.com/80-20-guide-to-express-error-handling.html](http://thecodebarbarian.com/80-20-guide-to-express-error-handling.html)

> 1달동안 글을 안썼더니 글쓰는게 너무 어색해졌다. 앞으로 자주 써야겠다.
