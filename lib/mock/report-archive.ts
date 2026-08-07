import type { CardResponse } from "@/types/feed";
import type { ReportArchiveMockMeta } from "@/types/report-archive";

/**
 * 내 보고서 전체 보기(/reports) — **mock 전용 데이터** (목업 library.html 우선 구현 단계).
 *
 * 여기 값은 전부 API 미제공 필드다(태그·유형·공개·SNS 통계 + 데모 항목). 조회수·조회 이력은 노출 금지 확정 개념이라 mock 에도 없다.
 * 실제 GET /api/feed 응답(CardResponse)과 절대 섞어 정의하지 않으며, 병합은
 * lib/adapters/report-archive-mock.ts 한 곳에서만 한다. 실 API 확정 시 이 파일을 삭제하고
 * 서버 필드로 교체한다(백엔드 요청 목록은 CLAUDE.md §/reports 참조).
 *
 * 모드 결정: NEXT_PUBLIC_REPORT_ARCHIVE_MOCK — **opt-in**
 * - "true" → mock 디자인 검증 모드(로컬 디자인 QA 에서만 명시적으로 켠다)
 * - 미설정·"false"·그 외 → **실 API 모드(운영 기본)** — 실측 필드만 렌더, mock UI 자동 숨김.
 *   미설정이면 mock 이 절대 켜지지 않으므로 운영·main 배포에 데모 데이터가 섞일 수 없다.
 */
export const REPORT_ARCHIVE_MOCK_ENABLED = process.env.NEXT_PUBLIC_REPORT_ARCHIVE_MOCK === "true";

/** 태그 필터 선택지(목업 kbf-row 태그 행). 단일 선택, "전체"는 화면에서 "all" 로 다룬다. */
export const MOCK_ARCHIVE_TAGS = ["#환율", "#AI", "#반도체", "#쇼핑"] as const;

/**
 * 실 카드에 입힐 mock 메타 풀 — 실 publicId 를 미리 알 수 없으므로 디자인 모드에서는
 * 인덱스 순환으로 배정한다(adapters/report-archive-mock.ts). 통계는 화면 검증용 소량 값.
 *
 * `reportType` 은 여기 없다 — 실 계약 필드가 됐고, 실 카드에 임의의 종류를 배정하면 서버가
 * 주지 않은 값을 사실처럼 보여주게 된다. 종류 배지는 실 응답(CardResponse.reportType)이
 * 있을 때만 뜨고, 디자인 확인용 종류 견본은 아래 데모 항목이 담당한다.
 */
export const MOCK_ARCHIVE_META_POOL: ReportArchiveMockMeta[] = [
  {
    tags: ["#환율"],
    category: "시장 · 경제",
    visibility: "PRIVATE",
    likeCount: 0,
    commentCount: 0,
  },
  {
    tags: ["#쇼핑"],
    category: "라이프",
    visibility: "PRIVATE",
    likeCount: 0,
    commentCount: 0,
  },
  {
    tags: ["#AI"],
    category: "AI · 테크",
    visibility: "PUBLIC",
    likeCount: 4,
    commentCount: 1,
  },
];

/** 데모 항목 1건 = 실 DTO 모양(CardResponse) + mock 메타 — 화면 조립 전까지 출처를 분리 보관. */
export type ArchiveDemoItem = {
  card: CardResponse;
  meta: ReportArchiveMockMeta;
};

/**
 * 목록 경로(GET /api/feed) 소셜 필드 계약 — author·likeCount·liked 는 **단건 상세에서만** 채워지고
 * 목록 응답에서는 셋 다 null 이다(service-api CardResponse.from 실측). 데모 카드도 같은 모양을 지킨다.
 * 화면에 보이는 ♡ 수·공개 배지는 실 API 값이 아니라 아래 meta(ReportArchiveMockMeta)에서 온다.
 */
const LIST_PATH_SOCIAL = { author: null, likeCount: null, liked: null } as const;

/** 데모 날짜 헬퍼 — 오늘 기준 상대 날짜(ISO). 데모 데이터는 표시 검증용이라 로드 시점 기준이면 충분하다. */
function daysAgoAt(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * 데모 아카이브 항목 — 목업 library.html 의 kb-card 내용 기반.
 * publicId 는 **기존 mock 상세 REPORT_REGISTRY(lib/mock/report.ts) 의 id** 를 재사용해
 * 카드 클릭 → /report/{id} 상세 이동이 mock 모드에서도 끝까지 동작한다.
 * (오늘 2 · 어제 1 · 이틀 전 1 · 지난달 1 · 지지난달 1 → 날짜 그룹·기간 필터·월별 rail 검증용)
 */
export const MOCK_ARCHIVE_DEMO_ITEMS: ArchiveDemoItem[] = [
  {
    card: {
      publicId: "post-fx-trigger",
      title: "원/달러 환율, 밤사이 0.8% 하락",
      summary: "미 CPI 발표를 앞두고 달러가 약세로 전환, 환전 예정 시점과 관련해 확인할 만한 변동이 감지됐습니다.",
      whyForYou: "관심사 ‘원/달러 환율’ 관련 변동 감지",
      sources: [
        { title: "한국은행 — 외환시장 동향 공시", url: "https://example.com/bok-fx" },
        { title: "달러 약세 전환 보도", url: "https://example.com/fx-news" },
        { title: "야간 거래 반응 스레드", url: "https://example.com/fx-thread" },
      ],
      reportType: "MORNING_BRIEFING",
      visibility: "PRIVATE",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(0, 7, 0),
    },
    meta: {
      tags: ["#환율"],
      category: "시장 · 경제",
      visibility: "PRIVATE",
      likeCount: 0,
      commentCount: 0,
    },
  },
  {
    card: {
      publicId: "post-us10y",
      title: "RTX 50 시리즈 국내 출시가 정리 — 관심 GPU 가격 추적 시작",
      summary: "엔비디아 신형 GPU 국내 가격이 공개됐습니다. 목표가 대비 현재 위치를 정리했어요.",
      whyForYou: "관심사 ‘노트북·전자기기 할인’ 관련 가격 변동",
      sources: [
        { title: "국내 출시가 공지", url: "https://example.com/rtx-price" },
        { title: "커뮤니티 시세 정리", url: "https://example.com/rtx-thread" },
      ],
      reportType: "ON_DEMAND",
      visibility: "PRIVATE",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(0, 14, 12),
    },
    meta: {
      tags: ["#쇼핑"],
      category: "라이프",
      visibility: "PRIVATE",
      likeCount: 0,
      commentCount: 0,
    },
  },
  {
    card: {
      publicId: "post-llm-release",
      title: "오픈소스 LLM 릴리즈 2건 — 벤치마크 갱신, 로컬 구동 요건 완화",
      summary: "새 모델 2종이 공개됐습니다. 사용 중인 스택 기준으로 적용 가능성을 정리했어요.",
      whyForYou: "관심사 ‘오픈소스 LLM’ 신규 릴리즈",
      sources: [
        { title: "릴리즈 노트", url: "https://example.com/llm-release" },
        { title: "벤치마크 비교", url: "https://example.com/llm-bench" },
        { title: "로컬 구동 가이드", url: "https://example.com/llm-local" },
        { title: "커뮤니티 반응", url: "https://example.com/llm-thread" },
      ],
      reportType: "MORNING_BRIEFING",
      visibility: "PUBLIC",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(1, 7, 0),
    },
    meta: {
      tags: ["#AI"],
      category: "AI · 테크",
      visibility: "PUBLIC",
      likeCount: 12,
      commentCount: 2,
    },
  },
  {
    card: {
      publicId: "post-earnings",
      title: "유로 강세 지속 — 분할 환전 2차 실행 시점 점검",
      summary: "달러 인덱스 하락이 이어지며 유로가 강세입니다. 설정하신 분할 환전 기준으로 2차 시점을 점검했어요.",
      whyForYou: "관심사 ‘원/달러 환율’ 분할 환전 계획",
      sources: [
        { title: "환율 동향 리포트", url: "https://example.com/eur-report" },
        { title: "달러 인덱스 추이", url: "https://example.com/dxy" },
      ],
      reportType: "ON_DEMAND",
      visibility: "PRIVATE",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(2, 7, 0),
    },
    meta: {
      tags: ["#환율"],
      category: "시장 · 경제",
      visibility: "PRIVATE",
      likeCount: 0,
      commentCount: 0,
    },
  },
  {
    card: {
      publicId: "post-fx-setup",
      title: "반도체 수출 규제 변화 — 보유 종목 영향 점검",
      summary: "규제 발표 이후 관련 종목 흐름과 증권가 해석을 모았습니다. 보유 종목 기준 영향은 제한적.",
      whyForYou: "관심사 ‘반도체’ 정책 변화",
      sources: [
        { title: "규제 발표 원문", url: "https://example.com/semi-policy" },
        { title: "증권가 해석 모음", url: "https://example.com/semi-analysis" },
      ],
      // 가입 직후 생성분 — 화면에는 "첫 리포트"로 표시된다(ONBOARDING 원문 노출 아님).
      reportType: "ONBOARDING",
      visibility: "PRIVATE",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(34, 7, 0),
    },
    meta: {
      tags: ["#반도체"],
      category: "주식 · 투자",
      visibility: "PRIVATE",
      likeCount: 0,
      commentCount: 0,
    },
  },
  {
    // 종류 미표시(fallback) 검증용 — card.reportType 을 **일부러 두지 않는다**.
    // 백엔드가 아직 이 필드를 안 주는 배포본·기존 보고서와 같은 상태이며, 배지가 사라지고
    // 나머지 메타(태그·시각)가 그대로 유지되는지 확인하는 자리다.
    card: {
      publicId: "today",
      title: "AI 코딩 도구 요금 개편 — 사용 중인 플랜 영향 비교",
      summary: "주요 AI 코딩 도구 2곳이 요금제를 바꿨습니다. 현재 플랜 기준 유지/이동 시나리오를 비교했어요.",
      whyForYou: "관심사 ‘AI 서비스 동향’ 요금 변경",
      sources: [
        { title: "요금 개편 공지", url: "https://example.com/ai-pricing" },
        { title: "플랜 비교 표", url: "https://example.com/ai-plans" },
        { title: "사용자 반응", url: "https://example.com/ai-thread" },
      ],
      visibility: "PRIVATE",
      ...LIST_PATH_SOCIAL,
      createdAt: daysAgoAt(65, 7, 0),
    },
    meta: {
      tags: ["#AI"],
      category: "AI · 테크",
      visibility: "PRIVATE",
      likeCount: 0,
      commentCount: 0,
    },
  },
];
