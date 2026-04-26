---
title: "[Vue] Provide / Inject vs Props"
date: 2021-09-06
tags:
  - "js"
  - "vue"
---

부모 컴포넌트에서 자식 컴포넌트로 데이터를 전달하는 방법은 두 가지가 있다. 첫 번째 방법은 **Props**를 이용해 자식 컴포넌트에게 데이터를 전달하는 것이고 두 번째 방법은 **Provide와 Inject**를 이용해 데이터를 전달하는 것이다. 지금부터 두 방법의 차이점과 장단점을 알아보자.

## Props
부모 컴포넌트에서 자식 컴포넌트로 데이터를 전달하는 일반적인 방법이다. 부모 컴포넌트와 자식 컴포넌트는 **아래로 단방향 바인딩(one-way-down binding)** 을  형성한다. 즉, 부모 컴포넌트에서의 데이터가 업데이트되면, 자식 컴포넌트의 prop들이 새로고침되는 방식이고, 자식 컴포넌트에서 prop를 변경하려 해서는 안 된다는 뜻이다.
일반적으로 다음과 같이 사용한다.

```js
const App = {
  data() {
    return {
      posts: [
        { id: 1, title: 'My journey with Vue' },
        { id: 2, title: 'Blogging with Vue' },
        { id: 3, title: 'Why Vue is so fun' }
      ]
    }
  }
}

const app = Vue.createApp(App)

app.component('blog-post', {
  props: ['title'],
  template: `<h4>{{ title }}</h4>`
})

app.mount('#blog-posts-demo')
```
```html
<div id="blog-posts-demo">
  <blog-post
    v-for="post in posts"
    :key="post.id"
    :title="post.title"
  ></blog-post>
</div>
```
부모 컴포넌트의 data에서 사용하고 싶은 것을 자식 컴포넌트의 props에서 선언한다. v-bind로 props를 동적으로 사용할 수 있다.

## Provide / Inject

일반적으로는 props를 사용해 데이터를 전달하지만 이게 매우 불편한 상황이 있다. **컴포넌트가 중첩**되어 멀리 있는 컴포넌트한테 데이터를 전달해야 하는 상황이다.

![[[Vue] Provide Inject vs Props-1-6081b48c8d.png]]

다음과 같이 컴포넌트가 구성되어 있을 때, 루트 컴포넌트에서 Grid로 데이터를 전달하고 싶으면 어떻게 해야 할까?

첫 번째 방법은 props를 두번 사용하는 것이다. Root -> Base -> Grid 순서로 전달하면 Grid에서 루트 컴포넌트의 데이터를 사용할 수 있다.

하지만 프로젝트 규모가 커지고 더 많은 컴포넌트가 필요해지면 목적지까지 가는 중간에 껴있는 수많은 컴포넌트의 props에 불필요한 데이터가 전달된다.

두 번째 방법은 provide, inject를 사용하는 것이다.

### 루트 컴포넌트
```html
<div>
  <active-element
    :topic-title="activeTopic && activeTopic.title"
    :text="activeTopic && activeTopic.fullText"
  ></active-element>
  <knowledge-base
    :topics="topics"
  ></knowledge-base>
</div>
```

```js
export default {
  data() {
    return {
      topics: [
        {
          id: 'basics',
          title: 'The Basics',
          description: 'Core Vue basics you have to know',
          fullText:
            'Vue is a great framework and it has a couple of key concepts: Data binding, events, components and reactivity - that should tell you something!',
        },
        {
          id: 'components',
          title: 'Components',
          description:
            'Components are a core concept for building Vue UIs and apps',
          fullText:
            'With components, you can split logic (and markup) into separate building blocks and then combine those building blocks (and re-use them) to build powerful user interfaces.',
        },
      ],
      activeTopic: null,
    };
  },
  provide() {
    return {
      topics: this.topics,
    };
  },
};
```

### Grid 컴포넌트 (중첩된 컴포넌트)

```html
<ul>
  <knowledge-element
    v-for="topic in topics"
    :key="topic.id"
    :id="topic.id"
    :topic-name="topic.title"
    :description="topic.description"
  ></knowledge-element>
</ul>
```

```js
inject: ['topics']
```

상위 컴포넌트에 provide에 전달하고싶은 데이터를 선언하고, 하위 컴포넌트에서 inject로 받아서 사용한다. 약간 장거리 props 느낌.. 어라? 그러면 그냥 props 안쓰고 provide/inject만 쓰면 되는거 아닐까?

provide, inject의 **두 가지 중요한 특징**이 있다.
>
1. 부모 컴포넌트는 **어떤 하위 컴포넌트가 provide된 속성을 사용하는지 알 필요가 없다.**
2. 자식 컴포넌트는 **inject된 속성이 어디서 왔는지 알 필요가 없다.**

이 특징이 props를 사용해야 할 때와 provide/inject를 사용해야 할 때를 구분해준다고 생각한다.

>provide, inject만 사용하면 **데이터가 어디에서 어디로 가는지 알 수 없다. **
props만 사용하면 멀리 **떨어진 컴포넌트에게 데이터를 전달하는게 매우 불편하다.**

따라서 두 가지 경우를 적절하게 사용해야 한다!
_나중에 Vue 디자인 패턴에 대해 더 공부해봐야겠다. _


출처: [v3.ko.vuejs.org/guide](https://v3.ko.vuejs.org/guide/component-provide-inject.html)
