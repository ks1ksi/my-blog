---
title: "[Vue] watch vs computed"
date: 2021-09-01
tags:
  - "js"
  - "vue"
---

## watch?
**감시 대상의 변경이 감지된 경우, 콜백을 실행한다.** HTTP request를 보내거나, 알림 창을 띄우거나 할 때 사용한다.
```js
watch: {
  counter(value) {
    if (value > 50) {
      this.counter = 0;
      alert("Reset!");
    }
  }
}
```
## computed?
프로퍼티처럼 사용하는데, **안에서 사용된 값의 변경이 감지된 경우 re-evaluate 하여 화면에 띄워준다.** methods의 경우는 안에서 사용되지 않은 값이 변경된 경우에도 call된다.
```js
computed: {
  fullName() {
    // use as property. property naming!
    // when this.name or this.lastName (all properties depend on this) changed -> call this.
    // only for output. not for event
    if (this.name === "" || this.lastName === "") {
      return "";
    }
    return this.name + " " + this.lastName;
  },
},
```

> 정리해보면 computed는 **미리 정의된 계산식에 따라 결과값을 반환**할 필요가 있을 때 사용하고, watch는 변화를 감지했을 때 **callback을 실행할 필요가 있을 때** 사용한다.
