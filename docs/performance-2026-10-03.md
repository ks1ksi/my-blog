# 초기 화면 로딩 개선 — 2026-10-03

## 변경 전 실측

Google PageSpeed Insights, Lighthouse 13.5.0으로 배포 커밋
`91c89d26c4227d0e1bc1a3ea14afe6f09f972cce`를 측정했다.
각 페이지·기기별 1회 실험실 측정이며 CrUX 방문자 데이터는 없었다.

| 페이지 / 기기 | 성능 | 접근성 | 권장사항 | SEO | LCP |
| --- | ---: | ---: | ---: | ---: | ---: |
| 홈 / 모바일 | 89 | 100 | 100 | 100 | 3,001ms |
| 홈 / 데스크톱 | 100 | 100 | 100 | 100 | 285ms |
| 2024 - 2025 회고 / 모바일 | 81 | 100 | 96 | 100 | 4,679ms |
| 2024 - 2025 회고 / 데스크톱 | 99 | 100 | 96 | 100 | 940ms |

- [홈 측정 보고서](https://pagespeed.web.dev/analysis/https-ks1ksi-io/kow4ju334q)
- [회고 측정 보고서](https://pagespeed.web.dev/analysis/https-ks1ksi-io-blog-2024---2025-%ED%9A%8C%EA%B3%A0/hoc1ahgoqz)

홈의 주요 원인은 렌더링을 막는 공통 CSS 요청이었다. 회고 글에서는
원본 해상도로 전송되는 이미지와 늦게 시작되는 첫 이미지 요청도 발견했다.
권장사항 감점에는 아직 토론이 없는 글의 Giscus API 404가 포함됐다.

## 적용 내용

- Astro `build.inlineStylesheets`로 공통 CSS를 HTML에 포함한다. CSS 내용과
  Pretendard 글꼴, 기존 녹색 테마를 유지하며 첫 렌더링 전 별도 CSS 요청을 없앤다.
  페이지마다 CSS가 포함되어 HTML이 커지는 비용은 아래 수치에 반영했다.
- Astro `image.layout`과 `image.breakpoints`로 Markdown 이미지의 WebP
  `srcset`을 생성한다. 본문 컨테이너 너비와 `sizes`를 맞춰 작은 화면에서
  필요한 해상도를 선택할 수 있게 한다. 원본 이미지와 본문은 보존한다.
- 짧은 도입부 뒤의 첫 로컬 이미지만 eager/high 우선순위로 요청한다.
  긴 본문·코드·목록·표 뒤의 이미지와 후속 이미지는 기존 지연 로딩을 유지한다.
  명시한 이미지 크기는 Astro가 처리한다.
- 댓글은 HTML `details`를 펼칠 때 불러온다. GitHub 링크와 실패 시 재시도를
  제공하고, Astro 페이지 이동으로 요소가 제거되면 이벤트를 정리한다.
  댓글 테마는 Giscus 메시지 API로 바꿔 작성 중인 iframe을 다시 로드하지 않는다.
  토론이 없는 글을 실제로 펼칠 때의 Giscus 404 응답 자체를 수정한 것은 아니다.

측정 도구나 브라우저 종류에 따라 콘텐츠·로딩 동작을 구분하지 않는다.

## 빌드 산출물 검증

| 항목 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 홈의 별도 렌더링 차단 CSS 요청 | 1 | 0 |
| 홈 CSS gzip 크기 | 25,147B | 25,205B (HTML에 포함) |
| 홈 HTML gzip 크기 | — | 29,185B |
| 회고 첫 이미지 2160px 원본 WebP | 227,416B | 유지 |
| 회고 첫 이미지 1024px 후보 | 없음 | 66,830B |
| 회고 첫 이미지 768px 후보 | 없음 | 41,178B |
| 회고 첫 이미지 384px 후보 | 없음 | 12,050B |

1024px 후보는 원본 대비 약 70.6% 작다. 어떤 후보를 전송하는지는 화면 너비,
기기 픽셀 비율과 브라우저 선택에 따라 달라진다. 파일 크기를 LCP 개선이나
Lighthouse 100점으로 환산하지 않는다.

검증: lint, Astro 타입 검사, 14개 테스트, 프로덕션 빌드, SEO·콘텐츠 검사 통과.
335개 페이지, 283개 글의 본문과 공개 주소·메타데이터를 보존했다.
482개 이미지의 반응형 후보 2,061개와 인라인 CSS의 로컬 글꼴 참조가 존재함을
확인했다. `scripts/measure-build.mjs`는 외부·인라인 CSS를 모두 집계한다.

## 재측정 상태

이 변경 이후 점수는 아직 확인되지 않았다. 브라우저 도구가 재연결 후에도
`Transport closed` 오류를 반환하며, 공개 PageSpeed API는 일일 할당량 초과로
429를 반환했다. 브라우저 연결이 복구되면 댓글 열기·테마 변경·페이지 이동을
확인하고, 배포 커밋을 기준으로 홈과 회고의 모바일·데스크톱을 다시 측정해야 한다.
기존 보고서를 변경 후 점수로 사용하거나 모든 페이지의 반복 100점을 보장하지 않는다.

설정 근거: [Astro 반응형 이미지](https://docs.astro.build/en/guides/images/#responsive-image-behavior),
[Astro 인라인 스타일 설정](https://docs.astro.build/en/reference/configuration-reference/#buildinlinestylesheets).
