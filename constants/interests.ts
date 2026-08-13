/**
 * 관심사 온보딩 표시용 카탈로그 — 목업 docs/design-handoff/product/onboarding.html 의 category·chip 구성.
 *
 * category 는 **화면에서 주제를 묶어 보여주는 표시 전용 그룹**이다. 서버(`/api/interests`)에는
 * category 개념·저장 필드가 없고 name 문자열만 저장된다(실측: InterestRequest.java, V1__init.sql).
 * → 여기 값은 ID·enum 이 아니라 순수 표시 문자열이며, 서버로는 topic(name)만 전송한다.
 *
 * topic 문자열이 곧 서버 name 값이다. 사용자가 직접 입력한 관심사도 같은 계약(name ≤ 100자)으로 저장된다.
 */
export type InterestCategory = {
  /** 표시 전용 그룹명 (서버 미전송). */
  label: string;
  /** 이 그룹에서 고를 수 있는 관심사(name 그대로 저장됨). */
  topics: string[];
};

/** 서버 계약의 name 최대 길이 — InterestRequest @Size(max=100) · V1 스키마 length=100 (실측). */
export const INTEREST_NAME_MAX = 100;

/**
 * 한 사용자가 고를 수 있는 관심사 최대 개수.
 *
 * **agent 계약이 정한 값이다(우리가 고른 UX 숫자가 아니다).** Service 가 관심사를 저장·삭제할
 * 때마다 agent `/internal/v1/users/{id}/context` 로 전체 목록을 동기화하는데, 그 요청의
 * `selected_topic_ids` 가 12개를 넘으면 agent 가 422 로 거절한다.
 *
 * ```
 * {"code": "REQUEST_VALIDATION_ERROR",
 *  "details": [{"type": "too_long",
 *               "message": "List should have at most 12 items after validation, not 17",
 *               "location": "body.selected_topic_ids"}]}
 * ```
 *
 * 그동안 아무도 몰랐던 이유는 성공한 동기화 453건이 전부 12개 이하였기 때문이다. 2026-08-13 에
 * 13개 이상 고른 사용자가 처음 나왔고, 온보딩이 503 으로 막히면서 드러났다. 화면이 먼저 막지
 * 않으면 사용자는 이유를 모른 채 "잠시 후 다시 시도해 주세요" 만 반복해서 보게 된다.
 */
export const INTEREST_SELECTION_MAX = 12;

export const ONBOARDING_INTEREST_CATALOG: InterestCategory[] = [
  {
    label: "시장 · 경제",
    topics: ["원/달러 환율", "금리·채권", "부동산", "원자재·유가", "거시경제 지표"],
  },
  {
    label: "주식 · 투자",
    topics: ["미국 증시", "국내 증시", "반도체", "ETF·배당", "크립토"],
  },
  {
    label: "AI · 테크",
    topics: ["오픈소스 LLM", "AI 서비스 동향", "빅테크", "하드웨어·GPU", "AI 정책·규제"],
  },
  {
    label: "개발",
    topics: ["프론트엔드", "백엔드·인프라", "오픈소스 릴리즈", "보안·취약점", "개발자 채용"],
  },
  {
    label: "비즈니스 · 시사",
    topics: ["스타트업·VC", "국제 정세", "정책·규제", "산업 동향"],
  },
  {
    label: "라이프",
    topics: ["노트북·전자기기 할인", "여행 특가", "스포츠", "게임", "건강·운동"],
  },
];

/** 카탈로그 전체 topic 평탄화 — 직접 추가 topic(카탈로그 밖)을 구분할 때 쓴다. */
export const ONBOARDING_CATALOG_TOPICS: ReadonlySet<string> = new Set(
  ONBOARDING_INTEREST_CATALOG.flatMap((category) => category.topics),
);
