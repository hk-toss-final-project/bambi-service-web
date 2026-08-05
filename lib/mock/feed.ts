/**
 * 홈 화면 mock UI 문구 — 목업 home-feed.html / home-my-reports.html 그대로.
 *
 * **피드 데이터는 더 이상 여기 없다.** 두 피드 모두 실 API 로 연결됐다:
 *   [피드]      GET /api/feed/public  (2026-08-04 — 공개 피드 카드 데이터 MOCK_POSTS 삭제)
 *   [내 보고서] GET /api/feed         (기존)
 * 데이터 로드는 lib/repositories/feed.ts(단일 seam) → 훅 → 어댑터(lib/adapters/card.ts) 경로만
 * 쓴다. 화면은 데이터 mock 을 import 하지 않는다.
 *
 * 남은 것은 **아직 API 가 없는 화면 크롬·문구**뿐이다(상단 nav placeholder · 좌측 메뉴 · 사이드
 * 푸터 · 피드 끝 문구 · 우측 레일 샘플). 각 항목이 어느 API 를 기다리는지는 아래 주석에 적는다.
 */

/** 카드 본문의 강조 세그먼트 (목업 <b> 대응) — mock 보고서 상세(lib/mock/report.ts)가 쓴다. */
export type TextSegment = { text: string; bold?: boolean };

/* ── 상단 nav / 좌측 메뉴 ── */

export const MOCK_NAV = {
  searchPlaceholder: "브리핑, 토픽, 사용자 검색",
  avatarInitial: "나",
};

/**
 * 정보구조 확정(07-27, 루트 CLAUDE.md §정보구조): 지식창고 삭제(홈 [내 보고서]와 동일 데이터).
 * 북마크(구 보관함=스크랩)·프로필은 07-31 백엔드(스크랩·프로필 API) 배포와 함께 노출됐다(§2).
 */
export const MOCK_MENU: { icon: string; label: string; count?: string; href?: string }[] = [
  { icon: "⌂", label: "홈", href: "/" },
  // 07-31 메뉴 전면 연결(우석 결정): 북마크(스크랩)·프로필 노출. 백엔드 API 배포 완료(#24·#26).
  { icon: "⚑", label: "북마크", href: "/scraps" },
  // count 는 붙이지 않는다 — 실데이터가 없어 목업 숫자가 화면 실제 개수와 어긋난다(/wiki 우측 레일은 실제 개수를 센다).
  { icon: "▤", label: "관심사 · LLM Wiki", href: "/wiki" },
  { icon: "◑", label: "프로필", href: "/profile" },
];

export const MOCK_MENU_BOTTOM: { icon: string; label: string; count?: string; href?: string }[] = [
  { icon: "⚙", label: "설정", href: "/settings" },
];

// "트리거"는 백엔드에 없는 개념(관심사·score만 존재) — UI 노출 금지(07-27 확정).
// 관심사 개수도 숫자를 박지 않는다 — /wiki 가 실제 개수를 보여주므로 목업 숫자와 충돌한다.
export const MOCK_SIDE_FOOT = ["다음 브리핑 · 내일 오전 7:00", "관심사 분석 중"];

/* ── [피드] 탭 ── */

/**
 * 피드 끝 문구. 데이터가 아니라 UI 카피다.
 * 보조 문구("무한 스크롤 대신, …")는 2026-08-05 화면에서 제거해 제목 한 줄만 남겼다 → sub 필드도 삭제.
 */
export const MOCK_FEED_END = {
  rec: { title: "오늘 피드는 여기까지예요" },
};

/* ── 우측 레일 ──
   MOCK_SIGNALS(오늘의 핵심 신호) · MOCK_TOPICS(추천 토픽)는 2026-08-04 삭제했다.
   대응 API 가 없어(신호 랭킹·신뢰도·토픽 추천 엔드포인트 전무) 홈 우측 rail 을 실데이터
   「내 보고서 현황 · 최근 내 보고서」(GET /api/feed 파생)로 교체했다 — components/home/side-right.tsx.
   신호·토픽은 백엔드 API 가 확정되면 그때 붙인다(카드 데이터를 신호·토픽으로 가공하지 않는다). */
