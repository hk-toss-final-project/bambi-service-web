# CLAUDE.md — bambi-service-web

> 이 파일은 **`bambi-service-web` 레포 전용** 작업 규약이다.
> 팀 전체 규약은 모노레포 루트 `CLAUDE.md`를 따르며, 이 문서는 **프론트엔드에 적용되는 것 + 이 레포에만 해당하는 것**만 담는다.
> 루트 규약과 충돌하면 **루트 규약이 우선**이고, 충돌 사실을 보고한다.
>
> **§3~§5의 API 스펙은 추측이 아니라 `bambi-service-api/api-smoke-test.http` 실행으로 얻은 실측값이다.** (검증일: 2026-07-15)

---

## 1. Repository Identity

| 항목 | 내용 |
|---|---|
| 레포 | `bambi-service-web` |
| 정체 | **밤새비서(코드명 Bambi / 팀·배포명 AlphaCatcher)** 의 **사용자용 웹 프론트엔드** |
| 서비스 개요 | 사용자가 저장한 웹 콘텐츠에서 관심사를 추론하고, 수집 정보와 매칭해 **출처 기반 카드 브리핑**을 제공 |
| 프론트 역할 | Service API가 내려주는 데이터를 화면으로 표현. **비즈니스 로직·AI 처리는 하지 않는다.** |
| 스택 | Next.js 16 (App Router) · TypeScript · Tailwind CSS · ESLint · Turbopack · npm |
| 구조 | `src/` 미사용 → `app/`이 루트에 위치 |
| 개발 단계 | **P0 / 초기 구현.** scaffold + 목업 반입 + 백엔드 로컬 연동 확인 완료. 화면 구현 착수 단계 |
| Claude Code 작업 범위 | 이 레포 내 프론트엔드 구현 (화면·컴포넌트·API client·인증 처리) |

### 다른 레포와의 역할 구분 (MUST)

| 레포 | 담당 | 이 레포에서 |
|---|---|---|
| `bambi-service-web` | **여진** | ← 작업 대상 |
| `bambi-admin-web` | 소라 | **건드리지 않는다.** 관리자 화면은 이 레포 범위 밖 |
| `bambi-service-api` | 우석·영현 | 호출만 한다. 코드 수정 금지 |
| `bambi-agent-api` | 송우(LLM팀)·소라 | **직접 호출 금지** (§8) |
| `bambi-build` | 우석 | 로컬 실행용. 수정 금지 |

---

## 2. 구현 범위와 우선순위

### P0 — 지금 구현할 화면 **4개만**

| 화면 | 목업 (`docs/design-handoff/product/`) | 주요 기능 | 사용 API | 필수 상태 | 우선순위 |
|---|---|---|---|---|---|
| **로그인** | `auth-login.html` | 이메일/비밀번호 로그인 → JWT 저장 | `POST /api/auth/login` **(확정)** | Initial / 제출중 / Error(인라인) / 중복제출 방지 | P0-1 |
| **회원가입** | `auth-signup-choice.html`(방식 선택)<br>`auth-signup-email.html`(이메일 폼) | 이메일 가입 (비밀번호 8자+) | `POST /api/auth/signup` **(확정)** | Initial / 제출중 / Error(인라인·중복이메일) / 중복제출 방지 | P0-2 |
| **홈 피드** | `home-feed.html`<br>`variants/home-feed-guest.html`(비로그인) | 카드 피드 목록 + **관심 자료 추가 모달**(피드 내부, 별도 페이지 금지) + **guest 상태**(비로그인 헤더 · 피드 단일 탭 · 아이콘 좌측 내비 · 우측 로그인/가입 유도 패널 · 가입 유도 모달 `#guest-modal`) | **확인 필요** | Loading / Empty / Error / Guest(비로그인 공개 열람 — 게이트 아님, §5) | P0-3 |
| **카드(리포트) 상세** | `report-detail.html`<br>`variants/report-detail-guest.html`(비로그인) | 카드 상세 + 출처 표시 + **guest 상태**(하단 Sticky 로그인·가입 CTA · 보관/공유/MD 복사/댓글 입력은 가입 유도 모달 · 공개 댓글만 표시) | **확인 필요** | Loading / Empty(Preparing) / Error / NotFound / Guest(비로그인 공개 열람) | P0-4 |

- **인증 API는 실측 확정** → 로그인/회원가입은 즉시 구현 가능.
- **피드/카드 상세 API는 미확정** (영현 도메인 API 착수 전). **경로·스키마를 추측해서 만들지 말 것.** 확정 전까지 화면 구조·상태 처리까지만 진행하고 데이터 연결부는 확인 요청.

### ⚡ 2026-07-27 범위 변경 (루트 CLAUDE.md §정보구조 확정)

- **P0 승격**: `home-my-reports.html`(홈 [내 보고서] — PR #16으로 기본 탭이 됨) · `wiki.html`(관심사 · LLM Wiki — 상단 AI 관심사 + 하단 내 저장 자료 결합 화면으로 Week2 구현)
- **화면 폐기**: `library.html`(지식창고) — 홈 [내 보고서]와 데이터가 동일. 필터는 홈 탭 상단, 검색은 글로벌 검색바, 관심사별 모아보기는 관심사 화면으로 흡수. 목업 파일은 레이아웃 참고용으로만 남긴다.
- **Week3 대기**: `saved.html`(보관함 → **"북마크"** 개명 = 남의 공개 보고서 스크랩) · `profile-*.html` — 공개 전환 API 이후. 그 전까지 내비에서 숨김. → **🔄 2026-07-31 해제(아래 범위 변경 참조).**

### ⚡ 2026-07-31 범위 변경 — 메뉴 전면 연결 (우석 결정)

- **북마크·프로필 P0 승격, 내비 5개 전면 노출**(홈·북마크·관심사 Wiki·프로필·설정). 백엔드 API가 이날 전부 배포됨:
  스크랩 3종(`GET /api/scraps` · `POST/DELETE /api/cards/{id}/scrap`, #26) · 공개 프로필 확장(bio·joinedAt) ·
  작성자 공개 카드(`GET /api/users/{id}/cards`) · 프로필 편집(`PUT /api/users/me`)(#24) · 리포트 본문(`GET /api/reports/{id}`, #25).
- **화면**: `/scraps`(saved.html 기준, member 전용 4분기) · `/users/[publicId]`(profile-user.html, **게스트 열람 허용** —
  공개 데이터, 팔로우 클릭만 게이트) · `/profile`(profile-self.html, 내비 정적 진입점 → 인증 사용자 publicId 로 재사용).
- **만들지 않은 것(API 없음 — 동작하지 않는 UI 금지 원칙)**: 사진 업로드 · 주간 활동 통계 · 비슷한 사용자 추천 ·
  프로필 "보관 N" 스탯 · **타인 카드 상세 진입**(공개 카드 단건 API 없음 — `GET /api/cards/{id}`는 내 것만.
  스크랩·타인 프로필의 "보고서 열기"는 이 API 협의 후. 후속: 영현) · 좋아요 토글(프로필 리스트에선 카운트 표기만).
- `/api/auth/me` 가 이제 로그인과 같은 `UserSummary`(publicId·username·bio 포함)를 반환 — `types/auth.ts` User 확장(optional).
- **UI 노출 금지 용어**: "트리거" · "조회수" — 백엔드에 없는 개념(관심사·score만 존재).
- **제품 모델**: 저장 ≠ 보고서 생성. 저장은 AI 요약·분류까지, 보고서는 정기 브리핑/온디맨드 생성으로만.

### ⚡ 2026-07-28 범위 변경 — 설정 화면 P1 → 구현 승인 (우석)

- **`settings.html` = P1 「구현하지 않는다」 목록에서 제외.** `/settings` 로 구현한다(PR #21).
  범위는 **실제로 지원 가능한 것만** — 화면 테마(라이트·다크·시스템) · 계정 이메일 표시(읽기 전용) · 로그아웃.
  목업의 이메일·비밀번호 변경 · 회원 탈퇴 · 브리핑 시간 · 알림 · 공개 범위 · 요금제는 **API·정책 미확정이라 제외**한다
  (동작하지 않는 토글·버튼을 만들지 않는다).
- **테마 저장 키 = `bambi.theme`** (`lib/theme.ts` 의 `THEME_STORAGE_KEY` 1곳에만 정의). 토큰 키와 같은 `bambi.` 네임스페이스.
  기본값 `system`. `documentElement` 에 `.dark` 를 토글하고, `app/layout.tsx` 의 인라인 스크립트가 paint 전에 선적용해 FOUC 를 막는다.
- ⚠️ **다크 모드가 이때 처음 실제로 켜졌다.** 그전까지 `.dark` 를 토글하는 코드가 없어 앱은 사실상 라이트 전용이었다.
  기본값이 `system` 이므로 **OS 가 다크인 사용자는 전 화면이 다크로 바뀐다.** 새 화면을 만들 때 다크 대비를 함께 확인할 것.

### ⚡ 2026-07-30 범위 변경 — 내 보고서 전체 보기(/reports, 지식창고 흡수)

- **독립 `지식창고` 화면·메뉴는 계속 폐기 상태다** (07-27 결정 유지). 그 핵심 역할(개인 보고서
  아카이브·검색)은 **홈 [내 보고서] → `전체 보기` → `/reports`(내 보고서 전체 보기)** 가 흡수한다.
  07-27 의 "검색은 글로벌 검색바" 문구는 이 결정으로 대체 — 개인 보고서 검색은 `/reports` 화면 검색이 담당한다.
- 진입: 홈 [내 보고서] 패널 상단 헤더 행(READY 목록이 있을 때만 노출 — 완전 Empty 는 온보딩 카드가
  CTA 를 제공하므로 겹치지 않음). 좌측 내비 메뉴는 추가하지 않는다(`홈 / 관심사 · LLM Wiki / 설정` 유지).
- **구현 단계 = 목업 우선(mock-first, 2026-07-30 기준 변경)**: 화면 구조·상호작용은 `library.html` 을
  기준으로 완성하고, API 에 없는 데이터는 **mock 계약으로 분리**해 구현한다(실 응답 위장 금지).
  - 실 API 연결(현재): title·summary·whyForYou·sources·createdAt(기간/정렬/날짜 그룹/시각/월별 집계)·
    publicId(상세 이동) — 전부 기존 `GET /api/feed`(`fetchMemberFeed`·`CardResponse` 재사용).
  - mock 전용(`lib/mock/report-archive.ts` + `lib/adapters/report-archive-mock.ts` seam):
    태그 필터·유형/공개 배지·♡/댓글 통계·데모 항목. **조회수·조회 이력(viewCount·lastViewedAt·
    「다시 찾은 보고서」)은 mock 에서도 제외**(2026-08-03 리뷰 — 노출 금지 확정 개념, 루트 CLAUDE.md §정보구조).
  - 모드: `NEXT_PUBLIC_REPORT_ARCHIVE_MOCK`(**opt-in**) — **미설정·`"false"`·그 외 = 실 API 모드(운영·main 기본,
    mock UI 자동 숨김, 화면 안 깨짐)** · `"true"` = mock 디자인 검증 모드(로컬 디자인 QA 에서만 명시적으로
    활성화). ✅ 07-30 의 "main 머지 전 기본값 반전" 항목은 2026-08-03 완료(미설정 = 실 API).
- 패널 확정: 태그(mock·단일) · 기간(전체/최근 7일/최근 30일) · 정렬(최신/오래된순) ·
  보기(**아이콘** 목록/그리드). **묶기 옵션 없음 — 날짜별 고정.** 우측 rail = 쌓인 기록(실측
  createdAt 월별 집계)만 — 목업의 「다시 찾은 보고서」는 미구현(조회 이력 = 금지 개념).
  **MD 내보내기 제외**(contentMd 없음), 그 자리는 결과 건수·검색 범위 안내.
- **실측 근거 (bambi-service-api, 2026-07-30)**: `GET /api/feed` 는 본인 카드 **전량**을 최신순 반환
  (FeedService "P0 피드는 '내 카드 전부'와 동치" · LIMIT/Pageable 없음) → "전체 보기" 성립.
  서버 페이지네이션·검색 API 없음 → 클라이언트 검색. `GET /reports/mine` 계열 없음.
- **백엔드 요청 목록(실 연결 시 mock 교체 대상)**: `tags: string[]`(→ card_interest_tags, 소라 협의 중) ·
  `category` · `reportType(MORNING_BRIEFING|ON_DEMAND)` · `visibility(PRIVATE|PUBLIC)` · `likeCount`·`commentCount` ·
  대량 대비 `GET /api/reports/mine`(검색·필터·정렬·페이지네이션) · 페이지네이션 시 월별 건수 집계 API ·
  (후순위) 상세 `contentMd`. **조회수 계열(viewCount·lastViewedAt·recently-viewed)은 요청하지 않는다**
  (07-31 확정: 조회수 노출 금지·API 안 만듦).
- ⚠ **관심 자료 저장 의미 — ✅ 2026-08-03 해소**: 동기 즉시 카드는 `app.agent.immediate-card.enabled`
  플래그로 격리됐고(service-api #28) **배포 서버는 OFF** — 저장은 자료 저장(+위키 중계)만 하고
  응답 `data.card` 는 **null** 이다(정책 "저장 ≠ 보고서 생성" 과 일치). 프론트는 저장 응답의 card 를
  사용하지 않고 refetch 만 하므로 영향 없음(실측). 보고서는 발행 경로(claim)로만 피드에 도착한다.
  로컬 compose 는 기본 ON(즉시 카드 유지) — 배포와 로컬의 저장 응답 모양이 다를 수 있음에 유의.
- `북마크`(Week 3)는 남의 공개 보고서 스크랩으로 **내 보고서와 별개** — 이 화면과 섞지 않는다.

### ⚡ 2026-07-30 범위 변경 — 관심사 온보딩 구현 승인

- **`onboarding.html` = P1 「구현하지 않는다」 목록에서 제외.** `/onboarding` 으로 구현한다.
- **신규 가입 흐름 변경**: 이메일 가입 성공 → 자동 로그인 성공 → **`/onboarding`** → 관심사 저장 성공 → 완료 화면 → 홈 `/`.
  자동 로그인 실패 시 기존 `/login?signedUp=1` 유지. **신규 가입 흐름만 온보딩으로 보낸다** — 기존 회원
  로그인·전역 강제 리다이렉트·middleware 가드는 만들지 않는다(서버에 온보딩 완료 여부 필드 없음).
- **관심사 최소 1개 필수** (목업의 "최소 3개" 대체). "나중에 할게요" 건너뛰기 없음. 0개면 완료 CTA 비활성.
- 온보딩에서 고른 관심사는 사용자가 직접 설정한 값 = **source=USER**(서버 강제).
  agent 자동 추론 태그(INFERRED · `/api/wiki/tags`)는 조회·저장 어느 쪽에도 섞지 않는다.
- **관심사 저장 ≠ 보고서 생성.** 완료 화면은 첫 브리핑 생성·도착 시점(7:00 등)을 약속하지 않는다.
- category 는 화면 표시용 그룹일 뿐이다(서버에 category 저장 필드 없음). 서버로는 topic(name) 문자열만 저장한다.
- **실측 계약 (bambi-service-api `interest/` 소스 확인, 2026-07-30)**:
  `GET /api/interests`(내 목록) · `POST /api/interests {name}`(201 · name 1~100자 · 중복 409 `DUPLICATE_RESOURCE` · source 항상 USER) ·
  `PUT /api/interests/{id}`(rename) · `DELETE /api/interests/{id}`(soft delete). 전부 인증 필수.
  일괄 저장 endpoint 는 없다 → 선택 교체는 topic 단위 DELETE/POST 로 수행(`lib/repositories/interests.ts`).
  직접 입력 topic 도 동일 계약(자유 문자열)으로 저장 지원 → "관심사 직접 추가" 구현 확정.

### P1 — 목업만 두고 **구현하지 않는다 (MUST NOT)**

`search.html` · `notifications.html` · `profile-self.html` · `profile-user.html` · `saved.html` · 랜딩(`landing/landing-desktop.html`) · **소셜 로그인(Google)**

> `settings.html` 은 2026-07-28 우석 승인으로 이 목록에서 빠졌다 (아래 범위 변경 참조).
> `onboarding.html` 은 2026-07-30 구현 승인으로 이 목록에서 빠졌다 (위 범위 변경 참조).

> 목업에 있다는 이유로 구현하지 않는다. 범위 확장이 필요하면 먼저 보고한다.
> 단, **비로그인 guest 최소 UI(guest 헤더 · 피드 단일 탭 · 가입 유도 모달 · 상세 Sticky CTA)는 P1이 아니라 P0**다 (§15 2026-07-21 결정).

---

## 3. API 응답 규약

### 공통 포맷 (실측 확인됨)

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};
```

```jsonc
// 성공
{ "success": true, "data": { /* ... */ }, "error": null }

// 실패
{ "success": false, "data": null, "error": { "code": "DUPLICATE_RESOURCE", "message": "..." } }
```

> **예외:** `GET /api/health`는 공통 포맷을 따르지 않고 `{"status":"UP"}`만 반환한다. (헬스체크 전용)

### 원칙 (MUST)

- HTTP status만 보지 않는다. **`success`와 `error.code`를 함께 확인**한다.
- **화면 컴포넌트에서 응답을 제각각 해석하지 않는다.** 공통 API client + 공통 에러 처리 계층을 반드시 통과시킨다.
- **서버 `error.message`를 사용자에게 그대로 노출하지 않는다.** `error.code` 기준으로 프론트가 정의한 문구를 보여준다. (message는 로깅·디버깅용)
- `success: true`여도 **`data`가 `null`/빈 배열일 수 있다.** 항상 처리한다.
- 응답 타입에 `any` 금지. 제네릭 + 도메인 타입으로 정의한다.

### 실측 기반 타입 (그대로 사용할 것)

```ts
export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export type User = {
  id: number;
  email: string;
  displayName: string;
  roles: string[];        // 예: ["USER"] / ["ADMIN"]
};

export type LoginData = {
  accessToken: string;
  tokenType: string;        // "Bearer"
  expiresInMinutes: number; // 120
  user: User;               // ★ 로그인 응답에 user가 동봉된다
};

export type SignupData = User;
```

---

## 4. 에러코드별 화면 처리 방침

백엔드 enum(`bambi-service-api` → `common/error/ErrorCode.java`) 실측 기준 **공통 에러코드 7종**. 프론트 문구 매핑은 **`constants/errors.ts` 단일 소스**.

> **§4 갱신(2026-07-15):** `AUTH_INVALID_CREDENTIALS`(로그인 실패)가 실제 백엔드 enum에 존재하고 `AuthService.login`이 실제로 던지지만, 기존 "6종" 요약에 누락돼 있었다. 로그인 인라인 에러에 필수라 **7번째 코드로 추가**했다.

| code | HTTP | 의미 | 발생 예시 | 프론트 처리 | 사용자 UI | 로그인 이동 | 재시도 |
|---|---|---|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청값 검증 실패 | 비밀번호 8자 미만, 이메일 형식 오류 | 해당 입력 필드에 매핑 | **인라인 필드 오류** | ✕ | 수정 후 재제출 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 로그인 자격 증명 불일치 | 이메일 없음·비밀번호 틀림 (`AuthService.login`) | 로그인 폼 인라인 에러 | **인라인 안내** ("이메일 또는 비밀번호가 일치하지 않아요") | ✕ | 수정 후 재제출 |
| `AUTH_INVALID_TOKEN` | 401 | 인증 없음/토큰 만료·무효 | 만료 JWT로 `/api/auth/me` 호출 | **토큰·인증 상태 제거** 후 이동 | 로그인 화면 ("로그인이 만료됐어요") | **○** | ✕ (자동 재요청 금지) |
| `FORBIDDEN` | 403 | 권한 부족 | USER가 관리자 리소스 접근 | 접근 차단 | 403 안내 화면 | ✕ | ✕ |
| `NOT_FOUND` | 404 | 리소스 없음 | 삭제된 카드 상세 진입 | 목록 복귀 경로 제공 | Not Found / Empty State | ✕ | ✕ |
| `DUPLICATE_RESOURCE` | 409 | 중복·충돌 | **이미 가입된 이메일로 회원가입 (실측 확인됨)** | 사용자가 고칠 수 있게 안내 | 인라인 안내 ("이미 가입된 이메일이에요") | ✕ | 수정 후 재제출 |
| `INTERNAL_ERROR` | 500 | 서버 오류 | 백엔드 예외 | 공통 에러 처리 | **Error State + 재시도 버튼** | ✕ | **○** |

### 규칙 (MUST)

- 위 7종 **외의 코드를 프론트에서 새로 만들지 않는다.** 미정의 코드가 오면 `INTERNAL_ERROR`에 준해 처리하고 보고한다. (코드명은 백엔드 `ErrorCode.java`와 1:1)
- `AUTH_INVALID_TOKEN` 처리 시 **무한 리다이렉트·무한 재요청 금지.** (이미 로그인 페이지면 이동하지 않음)
- **에러코드 → 사용자 문구 매핑은 한 곳(상수/유틸)에 모은다.** 페이지마다 문구를 새로 쓰지 않는다.

---

## 5. 인증 규약

### 원칙

- JWT **access token을 `localStorage`에 저장**한다. (P0 확정. httpOnly cookie + refresh token 전환은 P1)
- 인증 요청에는 **`Authorization: Bearer <token>`** 헤더를 붙인다.
- **토큰 주입은 공통 API client / 인증 유틸에서만.** 페이지·컴포넌트 개별 구현 **금지**.
- 로그아웃 시 **JWT + 인증 관련 사용자 상태를 모두 제거**한다.
- 인증 실패·만료 시 **무한 재요청 금지** (§4).
- **홈 `/`·리포트 상세 `/report/[id]`는 공개 화면** — 비로그인도 본문을 열람할 수 있으며 로그인 리다이렉트 가드를 두지 않는다. 저장·좋아요·공유·MD 복사·댓글 입력·`＋ 관심 자료`·비로그인 제한 내비 아이콘 등 인증 필요 액션만 가입 유도 모달(`#guest-modal`)로 차단한다 (§15 2026-07-21).
- Protected Route(인증 상태 확인 전 본문 미노출)는 **로그인 전용 화면에만** 적용한다. 공개 화면에서는 본문은 즉시 노출하되, 로그인 전용 UI(아바타·알림·내 보고서 탭 등)만 인증 확인 전 노출하지 않는다.

### 인증 API — **실측 확정**

| 메서드 | 경로 | 요청 | 성공 status |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password(8자+), displayName }` | **201** |
| POST | `/api/auth/login` | `{ email, password }` | **200** |
| GET | `/api/auth/me` | 헤더 `Authorization: Bearer <token>` | 200 |

**회원가입 성공 응답 (201)**
```jsonc
{
  "success": true,
  "data": { "id": 2, "email": "...", "displayName": "우석", "roles": ["USER"] },
  "error": null
}
```

**로그인 성공 응답 (200)** ★
```jsonc
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresInMinutes": 120,
    "user": { "id": 2, "email": "...", "displayName": "우석", "roles": ["USER"] }
  },
  "error": null
}
```

**회원가입 중복 이메일 (409)** — 실측 확인됨
```jsonc
{ "success": false, "data": null, "error": { "code": "DUPLICATE_RESOURCE", "message": "..." } }
```

### 확정 사항 (MUST)

| 항목 | 값 |
|---|---|
| 토큰 위치 | **`response.data.accessToken`** (최상위 아님) |
| tokenType | `"Bearer"` |
| 만료 | `expiresInMinutes: 120` (2시간) |
| **로그인 후 user 조회** | 로그인 응답의 **`data.user`를 사용한다.** → **로그인 직후 `/api/auth/me` 재호출 금지** (불필요한 왕복) |
| `/api/auth/me` 용도 | 새로고침·재진입 시 **저장된 토큰 유효성 확인 및 사용자 복구**용 |
| roles | `string[]` |
| 토큰 localStorage key | **`bambi.accessToken` — 확정 (2026-07-15 프론트 결정).** 문자열 리터럴을 코드에 흩뿌리지 말고 상수 **`ACCESS_TOKEN_STORAGE_KEY`** 로 **`constants/auth.ts` 1곳에만 정의**한 뒤 전부 이 상수를 import(`@/constants/auth`)한다. 저장·조회·삭제(로그아웃)는 모두 이 상수를 쓰는 인증 유틸을 경유. (레포에 기존 정의 없음 확인 → 신규) |

> **토큰 key 근거:** 서드파티 스크립트와의 키 충돌을 피하려고 `bambi.` 네임스페이스를 붙이고, 응답 필드명(`accessToken`)과 일치시켰다. 값은 팀에도 공유할 것.

> `/api/notes`는 백엔드 CRUD **견본(템플릿)** 이다. 프론트 구현 대상 아님.

---

## 6. API Base URL / 환경변수

```ts
process.env.NEXT_PUBLIC_API_URL
```

### 원칙

- **MUST NOT**: 컴포넌트·유틸·repository 어디에도 `localhost`, IP, 배포 도메인을 **직접 작성하지 않는다.**
- **MUST**: 모든 API 요청은 공통 api-client를 통하고, base URL 결정은 **`getApiBaseUrl()` 1곳에서만** 한다.
- **same-origin fallback (MUST)**: `NEXT_PUBLIC_API_URL`이 있으면(trim 후 비어 있지 않으면) 그 origin을 **우선** 사용한다. **없거나 빈 문자열·공백뿐이면 빈 base → `/api/...` 상대경로로 현재 서비스 origin(same-origin)에 요청**한다. 운영의 `/api` 전달은 **nginx 프록시**를 전제로 한다. (throw 하지 않는다)
- **로컬 개발**: 필요 시 `.env.local`의 `NEXT_PUBLIC_API_URL`(예: `http://localhost`)을 사용할 수 있다.
- **MUST NOT**: `.env.local` 커밋 금지. `.env.example`에는 **키만** 기록.
- **MUST NOT**: `NEXT_PUBLIC_*`에 **비밀값을 넣지 않는다.** (브라우저에 그대로 노출됨) 실제 운영 URL·quick tunnel 주소를 문서·소스에 넣지 않는다.

### 환경 값

| 환경 | 값 | 상태 |
|---|---|---|
| 로컬 | **`NEXT_PUBLIC_API_URL=http://localhost`** (nginx 80 → backend 8080). `/api`는 base가 아니라 경로에 → `http://localhost/api/health` = `{"status":"UP"}` | **실측 확인됨** |
| 배포(운영) | **`NEXT_PUBLIC_API_URL` 비움** → same-origin 상대경로 `/api/*`. 운영 nginx가 같은 origin의 `/api/*`를 service-api로 전달. 정식 배포는 `.github/workflows/image.yml`(GCP 이미지) 방식 | **확정** (2026-07-24, 우석 정책·배포 승인) |

> **`/api` prefix — 확정 (2026-07-15 프론트 결정): `NEXT_PUBLIC_API_URL`은 origin(scheme+host)까지만 담고 `/api`는 요청 경로에 둔다.**
>
> - 값 예: 로컬 `http://localhost` — **끝에 `/` 없음, `/api` 없음.**
> - 요청 예: `` `${NEXT_PUBLIC_API_URL}/api/auth/login` `` · 헬스체크 `` `${NEXT_PUBLIC_API_URL}/api/health` ``
> - **근거:** 이 문서·smoke test·팀 커뮤니케이션이 전부 `/api/...` **전체 경로**로 엔드포인트를 지칭한다. base에 `/api`를 넣으면 코드상 경로(`/auth/login`)가 문서 계약과 어긋나므로, 경로를 계약과 1:1로 유지하려고 origin-only로 통일한다.
> - `/api` 결합은 **공통 API client 1곳에서만** 수행한다. 컴포넌트·유틸에서 URL을 조립하지 않는다 (§8).
> - 배포 주소도 **origin-only 형태로 받는다** (`https://<host>`, 뒤에 `/api` 붙이지 않음).

### 배포

- **정식 배포:** `.github/workflows/image.yml` → GHCR 이미지 빌드 → bambi-build 서버 배포(GCP). 이미지 빌드는 `NEXT_PUBLIC_API_URL`을 **비운 채** 수행 → 런타임 same-origin `/api/*`.
- 운영은 **nginx가 같은 origin의 `/api/*`를 service-api로 전달**하는 것을 전제로 한다.
- 다른 origin의 절대 API를 써야 하는 환경에서만 배포 변수 `NEXT_PUBLIC_API_URL`(origin-only)을 설정한다. **레포에 실제 운영 URL·tunnel 주소를 하드코딩·커밋하지 않는다.** (GitHub 변수 관리는 우석 담당)

---

## 7. 디자인 / 목업 기준

### 경로

```text
docs/design-handoff/
├── product/      # 서비스 화면 목업 (구현 기준)
├── shared/       # tokens.css · base.css · product-components.css · product-common.js
├── components/   # ui-kit.html (컴포넌트 인벤토리)
├── foundations/  # foundations.html (타이포·컬러)
├── variants/     # 대안 시안 (참고용)
├── admin/        # 관리자 — 이 레포 범위 아님 (소라 참고용)
└── landing/      # 랜딩 — P1
```

### P0 화면 ↔ 목업 매핑

| 화면 | 목업 |
|---|---|
| 로그인 | `product/auth-login.html` — 한 파일에 **시작하기 / 계정 만들기 / 로그인 3개 뷰** |
| 회원가입(방식 선택) | `product/auth-signup-choice.html` |
| 회원가입(이메일 폼) | `product/auth-signup-email.html` |
| 홈 피드 | `product/home-feed.html` — **관심 자료 추가 모달(`#am-modal`)**, 가입 유도 모달(`#guest-modal` — **P0 실제 제품 UI**) 포함 |
| 홈 피드 (비로그인) | `variants/home-feed-guest.html` — guest 헤더(검색·알림·아바타 없음, 로그인/가입하기) · 피드 단일 탭 · 인증 필요 액션 → `#guest-modal` |
| 카드 상세 | `product/report-detail.html` |
| 카드 상세 (비로그인) | `variants/report-detail-guest.html` — guest 헤더 · 보관/공유 → `#guest-modal` · 하단 Sticky 로그인·가입 CTA |

### 원칙

- 목업의 **정보 구조 · 레이아웃 · 문구 의도**를 우선 반영한다.
- HTML 목업을 **그대로 복사하지 않는다.** Next.js 구조·컴포넌트 체계에 맞게 재구현한다.
- **디자인 토큰(`shared/tokens.css`)을 우선 사용한다.** `--signal:#FF5A00`, `--ink`, `--bg`, `--line`, 스켈레톤(`--skel1/2`), 에러(`--err`) 등 CSS 변수 + light/dark 테마 정의됨.
- **shadcn/ui 도입 시 목업 디자인을 shadcn 기본 스타일로 덮어쓰지 않는다.** 토큰에 맞춰 조정한다.
- 공통 UI는 재사용 컴포넌트로 분리하되 **과도한 추상화 금지** (§11).
- 반응형 고려. `label` · `focus` · 키보드 인터랙션 등 접근성 구현.
- **P0 범위 밖 기능·화면은 목업에 있어도 추가하지 않는다.**

### ⚠ 목업 ↔ API 충돌

| # | 충돌 | 상세 | 처리 |
|---|---|---|---|
| 1 | **회원가입 `displayName`** | API는 `displayName` **필수(실측 확인)**. 목업 `auth-signup-email.html`에는 **email·password 입력만** 존재 | **✅ 해소 — 목업과 다르게 간다.** 회원가입 폼에 **`displayName` 입력 필드를 추가**한다. 목업의 스타일·디자인 토큰·레이아웃 언어는 그대로 유지하고, 기존 email/password 필드와 **동일한 마크업 패턴**으로 추가할 것. 라벨/placeholder 문구는 목업 톤에 맞춘다. 필드 순서는 displayName → email → password 권장 |
| 2 | **Google 로그인 버튼** | 목업에 "Google로 계속하기" 존재. 소셜 로그인은 **P1** | P0 미구현. 노출 여부(숨김/비활성) **확인 필요** |

---

## 8. Architecture Invariants (불변식 — 위반 금지)

```text
Browser / Next.js Web
        ↓
Bambi Service API        ← 프론트가 호출하는 유일한 대상
        ↓
Agent API · 내부 서비스 · DB
```

**금지 구조:**

```text
Browser / Next.js Web
        ✕
Agent API 직접 호출
```

- **MUST**: 프론트엔드는 **Service API만** 호출한다.
- **MUST NOT**: **Agent API(FastAPI)를 직접 호출하지 않는다.**
- **MUST NOT**: Agent 내부 구현·모델 제공자에 의존하지 않는다.
- **MUST NOT**: 브라우저에서 **LLM API key·서버 비밀키를 사용하지 않는다.**
- **MUST NOT**: DB(PostgreSQL 등)에 직접 접근하지 않는다. (내부 전용)
- **MUST NOT**: 프론트 편의를 위해 서비스 간 통신 구조를 임의로 변경하지 않는다.
- **MUST**: 새 API가 필요하면 **프론트에서 우회 구현하지 말고** Service API 변경 사항으로 정리해 제안한다.
- **MUST**: 모든 외부 요청은 **정의된 API client 계층**을 통과한다. 컴포넌트에서 `fetch` 직접 호출 금지.

---

## 9. 필수 UI State (완료 조건)

> **Loading / Error / Empty State는 선택이 아니라 완료 조건이다.** 하나라도 없으면 미완료.

데이터를 다루는 모든 화면·컴포넌트는 아래를 구현한다.

- [ ] **Initial**
- [ ] **Loading** — 레이아웃이 과도하게 흔들리지 않게 (스켈레톤 토큰 `--skel1`/`--skel2` 활용 가능)
- [ ] **Success**
- [ ] **Empty** — Error와 **명확히 구분**. `success: true`여도 `data`가 비면 Empty
- [ ] **Error** — 가능한 경우 **재시도 동작 제공**
- [ ] **Unauthorized / Forbidden** — §4 매핑에 따름
- [ ] **제출 중(submitting)**
- [ ] **중복 제출 방지** — 요청 중 버튼 비활성

추가: 인증 확인 전 **보호 화면 본문이 노출되지 않도록** 한다.

---

## 10. 프로젝트 구조

현재 실존 구조:

```text
app/                  Next.js App Router (루트 위치, src/ 미사용)
public/
docs/design-handoff/  디자인 목업 (구현 기준, 빌드 대상 아님)
```

기능 추가 시 권장 역할 분리 — **필요할 때 생성한다. 미리 빈 폴더를 만들지 않는다.**

| 폴더 | 역할 |
|---|---|
| `app/` | route · page · layout |
| `components/` | 공통 UI · 화면 컴포넌트 |
| `lib/` | **API client**, auth 유틸, 공통 utility |
| `types/` | API 응답 · 도메인 타입 |
| `hooks/` | 공통 client hook |
| `constants/` | route, error code 매핑, **토큰 key(`constants/auth.ts` → `ACCESS_TOKEN_STORAGE_KEY = "bambi.accessToken"`)** 등 상수 |

---

## 11. 구현 규칙

- **TypeScript 사용.** 불필요한 `any` **금지**.
- API 응답 타입과 화면 모델 타입을 정의한다. (§3 실측 타입 사용)
- 페이지 컴포넌트에 **API 처리 + UI 로직을 모두 몰아넣지 않는다.**
- 공통 컴포넌트를 **과도하게 추상화하지 않는다.** 한 번만 쓰이는 작은 UI까지 무조건 분리하지 않는다. (루트 규약: "MVP 우선, 과한 추상화 금지")
- 서버 컴포넌트 / 클라이언트 컴포넌트를 **목적에 맞게 구분**. `'use client'`를 페이지 전체에 습관적으로 붙이지 않는다.
- 환경변수 누락 시 **원인을 알 수 있는 오류** 제공.
- 완료 코드에 **console log · 임시 데이터 · TODO mock 남기지 않는다.**
- 기존 설정과 **패키지 매니저(npm)** 우선.
- **대규모 리팩터링은 요청받은 작업과 직접 관련될 때만.**
- API Key / Secret / `.env` **커밋 금지**. `.env.example`만 커밋.

---

## 12. 실행 및 검증

### 명령어

| 목적 | 명령어 | 상태 |
|---|---|---|
| 의존성 설치 | `npm install` | 확인됨 |
| 개발 서버 | `npm run dev` → `http://localhost:3000` | **동작 확인됨** |
| production build | `npm run build` | **확정** — `package.json`에 `build` 존재 |
| production 서버 | `npm run start` | **확정** — `build` 후 실행용 (`start` 존재) |
| lint | `npm run lint` (= `eslint`) | **확정** — `package.json`에 `lint` 존재 |
| type check | `npx tsc --noEmit` | **확정** — 전용 script 없음. `tsconfig.json`이 `noEmit: true`라 타입 검사 전용으로 동작 |
| 테스트 | **없음** — test script·러너 미설정 | **확정** — P0 범위 밖. 임의로 script·러너 추가 금지 |

> 현재 `package.json` scripts는 **`dev` / `build` / `start` / `lint` 4개뿐이다.** 여기 없는 script(`typecheck`, `test` 등)를 임의로 만들어 문서·명령에 넣지 말 것.

### 백엔드 로컬 실행 (이 레포 밖, 참고용)

```bash
cd ../bambi-build
cp .env.example .env      # 최초 1회
docker compose up --build
# 헬스: http://localhost/api/health → {"status":"UP"}
```

- API 스모크 테스트: `bambi-service-api/api-smoke-test.http` (VSCode REST Client 확장으로 실행)

### 작업 완료 전 최소 검증 체크리스트

- [ ] lint 통과
- [ ] TypeScript 오류 없음
- [ ] production build 통과
- [ ] 주요 화면 수동 확인
- [ ] **Loading / Error / Empty State 확인**
- [ ] 인증 **성공 및 실패** 흐름 확인
- [ ] **하드코딩된 API URL 없음 확인**
- [ ] `.env.local` 등 비밀정보 미커밋 확인

---

## 13. Git 작업 규약

루트 규약: `main`(배포) · `develop`(통합) · `feature/*`, **PR로만 머지.**

```text
main(또는 develop) 최신화 (git pull)
→ feature 브랜치 생성
→ 작업
→ 로컬 검증 (lint / type check / build)
→ commit
→ push
→ Pull Request
```

- **MUST NOT**: `main`에 직접 커밋·푸시.
- 작업 단위별 **`feature/<작업명>`** 브랜치 (예: `feature/yeojin-auth-ui`).
- 브랜치는 **일회용**. 머지 후 새 작업은 최신 `main`에서 새로 분기.
- **하나의 PR에 하나의 목적**만. 무관한 대규모 리팩터링 섞지 않기.
- 커밋 메시지는 **변경 의도**가 드러나게.
- PR 본문: 작업 내용 / 확인 방법 / 화면 변경(스크린샷) / 남은 이슈.
- **환경변수 파일·비밀정보 커밋 금지.**

---

## 14. Claude Code 작업 방식

- 작업 전 **관련 문서와 기존 구현을 먼저 읽는다.** (루트 `CLAUDE.md`, 이 파일, `docs/design-handoff/`)
- **이미 존재하는 컴포넌트·유틸을 우선 재사용**한다.
- **요청받지 않은 API·기능·화면을 임의로 추가하지 않는다.** (특히 §2 P1 목록)
- **명세와 구현이 충돌하면 추측하지 말고 충돌 내용을 보고**한다.
- 파일 수정 전 **영향 범위 확인**.
- 변경 후 **lint · type check · build 수행**.
- **테스트하지 못한 항목을 완료했다고 표현하지 않는다.**
- 백엔드 수정이 필요하면 **프론트에서 임시 우회하지 말고** 필요한 API 변경점을 정리해 보고한다.
- **목업과 API 명세가 충돌하면** 제품 요구사항과 비교해 충돌을 **명시**한다. (§7 충돌 표)
- **확인되지 않은 값(토큰 key, 배포 주소, 미확정 API 경로)을 임의로 만들어 넣지 않는다.**
- 작업이 끝나면 **변경 파일 / 구현 내용 / 검증 결과 / 남은 이슈**를 요약한다.

---

## 15. 확인 필요 목록 (해소 전 임의 결정 금지)

### 팀 확인 대기
- [ ] **Google 로그인 버튼** 노출 여부 (§7-2)
- [ ] **홈 피드 / 카드 상세 / 관심 자료 저장 API** 경로·스키마 (영현 도메인 착수 전)

### 프론트 내부 결정 후 문서화
- (없음 — 아래 「해소 완료 · 프론트 내부 결정」 참조)

### ✅ 해소 완료 (2026-07-24) — 배포 API base (same-origin fallback)

**팀 결정 (우석 정책·배포 승인)** — 배포용 `NEXT_PUBLIC_API_URL` 절대 주소를 받는 대신 **same-origin fallback**으로 확정했다 (§6).

- ~~배포용 `NEXT_PUBLIC_API_URL` 확정 주소 (우석 제공 예정)~~ → **운영 빌드에서는 `NEXT_PUBLIC_API_URL`을 비운다.** 프론트는 same-origin `/api/*` 상대경로를 쓰고, 운영 nginx가 `/api/*`를 `service-api`로 프록시한다. base 결정은 `getApiBaseUrl()` 1곳(값 있으면 그 origin, 없으면 빈 base). 정식 배포는 `.github/workflows/image.yml`(GCP 이미지, 기본값 제거로 빈값 빌드). **GitHub 변수 `NEXT_PUBLIC_API_URL` 제거는 우석이 PR 머지 시점에 처리.**

### ✅ 해소 완료 (2026-07-21) — 비로그인 guest 정책

**팀 결정 (여진 확인)** — 기존 공개 피드 정책을 유지하면서 **guest 최소 UI를 P0로 구체화·재편입**했다. (2026-07-14의 게스트 "시안 설명 블록" 제거(DECISION-025)는 목업 주석 블록 정리였고 `#guest-modal`은 제품 UI로 유지돼 왔으므로, 본 결정과 모순되지 않는다.)

> ⚠️ **아래 항목의 내비 구성은 2026-07-21 시점 스냅샷이다.** 07-27 정보구조 확정(§2·루트 CLAUDE.md)으로
> **내비는 `홈` · `관심사 · LLM Wiki` 2개로 축소**됐다(지식창고 삭제, 보관함→북마크·프로필은 Week3까지 숨김).
> guest 정책 자체(공개 열람 유지 · 인증 액션만 게이트)는 그대로 유효하고, **메뉴 목록만 현재 §2 를 따른다.**

- ~~비로그인 사용자의 홈·상세 접근 정책~~ → **홈 `/`·리포트 상세 `/report/[id]` 공개 열람 유지. 로그인 리다이렉트 가드 금지 (§5)**
- ~~guest 상태 UI 범위~~ → **P0 최소 세트 확정: guest 헤더(검색·알림·아바타 숨김 · CTA 위계 = 가입하기 主(signal) / 로그인 보조 / `＋ 관심 자료` 중립 보조(hover 주황)) · 홈 피드 단일 탭(내 보고서 숨김) · 아이콘 전용 좌측 내비(member 내비와 동일 순서·아이콘: 홈→보관함→지식창고→관심사(Wiki)→프로필→구분선→설정, 카운트·알림 없음 — 홈만 진입, 나머지 게이트, label 대신 tooltip·aria-label) · 홈 우측 로그인/가입 유도 패널(인증 목업 시각 언어의 compact auth card — 로그인형 정보 패널 대체) · 가입 유도 모달(`#guest-modal` — 가입하기 Primary/로그인 Secondary/계속 둘러볼게요 Tertiary, 열릴 때 주 CTA 포커스·Esc 닫기·aria-labelledby/describedby) · 상세 하단 Sticky 로그인·가입 CTA**
- ~~인증 필요 액션의 비로그인 처리~~ → **저장·좋아요·공유·MD 복사·댓글 입력·`＋ 관심 자료`·제한 내비 아이콘 클릭 시 실행 없이 가입 유도 모달. 홈 카드 공유 아이콘은 버튼화하되 로그인 사용자용 실 공유 기능은 이번 범위에서 구현하지 않음**
- ~~댓글/메모 명칭~~ → **동일 입력 기능이며 보고서 공개 범위에 따라 명칭만 다름: 「나만 보기」=메모 · 「전체공개」=댓글. 전체공개 전환 시 기존 메모는 공개 댓글로 전환된다(기능 신설 아님). 비로그인은 전체공개 보고서만 열람하므로 guest 상세에는 공개 댓글만 표시**
- ~~홈 Empty CTA 연결~~ → ~~Empty 안내 문구는 구현하되 `관심사 관리하기` CTA의 실제 링크 연결은 보류. Wiki 라우트/화면은 P1 유지, `/wiki` 하드코딩 금지~~ → **🔄 2026-07-27 정보구조 확정으로 갱신됨: Wiki 는 P1 → P0 승격(§2), `/wiki` 라우트·화면 구현 확정(PR #18). `/wiki` 링크는 이제 정상이며 금지 대상이 아니다.** 좌측 내비의 `관심사 · LLM Wiki` 항목이 `/wiki` 로 연결된다.
- ~~로그아웃 흐름~~ → **백엔드 logout API 없음 → `logout()`의 로컬 토큰 제거 방식 확정. 제거 후 guest 전환, 공개 홈 `/` 유지**
- ~~가입 버튼 문구~~ → **guest 관련 UI(모달·guest 헤더·Sticky CTA) 전부 `가입하기`로 통일 (목업 원문 "시작하기" 대체)**
- ~~인증 복구 규칙~~ → **토큰 없으면 `getMe()` 미호출 guest / 토큰 있으면 `getMe()` → 성공 authenticated / 401·403 토큰 제거 후 guest / 500·네트워크 오류는 공개 콘텐츠 유지 + 로그인 전용 UI 숨김 + 재시도 제공**

### ✅ 해소 완료 (2026-07-15)

**실측 (`api-smoke-test.http` 실행 / 백엔드 소스 확인)**
- ~~에러 코드 세트~~ → **백엔드 `ErrorCode.java` 기준 7종 확정. `AUTH_INVALID_CREDENTIALS`(로그인 실패) 추가, `constants/errors.ts`에 문구 매핑 (§4)**
- ~~로그인 응답 내 `accessToken` 위치~~ → **`data.accessToken` 확정**
- ~~공통 응답 포맷 실제 준수 여부~~ → **`{success, data, error}` 확정**
- ~~회원가입 `displayName` 필수 여부~~ → **필수 확정 (201)**
- ~~회원가입 `displayName` 목업 충돌~~ → **목업과 다르게 간다. 회원가입 폼에 displayName 필드 추가로 확정 (§7-1)**
- ~~중복 이메일 에러 형태~~ → **`DUPLICATE_RESOURCE` 409 확정**
- ~~로그인 후 사용자 정보 조회 방법~~ → **로그인 응답에 `data.user` 동봉 → `/api/auth/me` 재호출 불필요**

**프론트 내부 결정 (레포 확인 후 문서화)**
- ~~토큰 localStorage key 이름~~ → **`bambi.accessToken` 확정. `constants/auth.ts`의 `ACCESS_TOKEN_STORAGE_KEY` 상수 1곳에 정의 (§5·§10)**
- ~~`NEXT_PUBLIC_API_URL`의 `/api` prefix 포함 여부~~ → **base는 origin-only(`http://localhost`), `/api`는 요청 경로에. 공통 client 1곳에서 결합 (§6)**
- ~~`package.json` script 목록~~ → **`dev` / `build` / `start` / `lint` 4개만 존재. type check는 `npx tsc --noEmit`, test 없음 (§12)**