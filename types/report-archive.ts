import type { CardSource } from "@/types/feed";
import type { ReportType } from "@/types/report";

/**
 * 내 보고서 전체 보기(/reports) 화면 모델 — 목업 우선(mock-first) 단계.
 *
 * 실데이터 원천은 기존 GET /api/feed 의 CardResponse(types/feed.ts) 그대로다 — 중복 DTO 를 만들지
 * 않는다. API 에 없는 표시 요소(태그·유형·공개·SNS 통계)는 **ReportArchiveMockMeta 로 분리**해
 * 실제 응답인 것처럼 위장하지 않는다(병합은 lib/adapters/report-archive-mock.ts 한 곳).
 * 조회수·조회 이력은 UI 노출 금지 확정 개념이라 mock 에도 두지 않는다(루트 CLAUDE.md §정보구조).
 */
export type ArchiveCard = {
  publicId: string;
  title: string;
  summary: string;
  whyForYou: string;
  sources: CardSource[];
  /**
   * 검증을 통과한 보고서 생성 종류(실 API 필드). 서버가 안 주거나 계약 밖 값이면 null →
   * 화면은 종류 배지를 생략한다. mock 메타가 아니라 **실 응답에서만** 온다.
   */
  reportType: ReportType | null;
  /** createdAt(ISO) 파싱 결과(ms). 파싱 실패 시 null — 화면을 깨뜨리지 않고 "날짜 정보 없음" 그룹으로 보낸다. */
  createdAtMs: number | null;
  /** 카드 메타에 표시할 시각(예: "오전 7:00"). 파싱 실패 시 빈 문자열(표시 생략). */
  timeLabel: string;
};

/**
 * mock 전용 메타 — 전부 **API 미제공** 필드(백엔드 요청 목록의 근거).
 * 실 API 확정 시 서버 응답 필드로 1:1 교체하고 이 타입·mock 파일을 삭제한다.
 *
 * `reportType` 은 여기서 빠졌다 — 실 계약 필드(ArchiveCard.reportType)가 생겨 mock 이 같은 값을
 * 따로 들고 있으면 출처가 둘이 된다. 특히 mock 모드가 **실 카드에** 메타 풀을 순환 배정하던 구조라,
 * 그대로 두면 실제 종류를 모르는 카드에 임의의 종류가 붙는다(계약 위장 금지).
 */
export type ReportArchiveMockMeta = {
  tags: string[];
  category: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  likeCount: number;
  commentCount: number;
};

/**
 * 아카이브 항목 = 실데이터(card 필드) + mock 메타.
 * `mock === null` 이면 실 API 모드(또는 메타 없음) — 화면은 실측 필드만 렌더한다.
 */
export type ArchiveItem = ArchiveCard & {
  mock: ReportArchiveMockMeta | null;
};

/** 날짜 그룹 — label 은 "오늘 · 7월 10일" / "어제 · 7월 9일" / "7월 8일" / "2025년 12월 31일" / "날짜 정보 없음". */
export type ArchiveGroup<T> = {
  key: string;
  label: string;
  cards: T[];
};

/** 기간 필터 — 전부 실측 createdAt 만으로 계산 가능한 값(서버 필터 API 없음 → 클라이언트 순수 필터). */
export type ArchivePeriod = "all" | "7d" | "30d";

/** 정렬 — latest 는 서버 최신순 그대로, oldest 는 클라이언트 역정렬. */
export type ArchiveSort = "latest" | "oldest";

/** 보기 — 목록/그리드(아이콘 토글). 표시 방식만 바꾼다. */
export type ArchiveViewMode = "list" | "grid";

/** 태그 필터 값 — "all"(전체) 또는 mock 태그 1개(단일 선택). 태그 자체가 mock 전용 데이터다. */
export type ArchiveTagFilter = "all" | string;

/** 우측 rail "쌓인 기록" 1행 — 실측 createdAt 집계(막대 길이는 최대 건수 대비 비율). */
export type ArchiveMonthlyCount = {
  key: string;
  label: string;
  count: number;
};
