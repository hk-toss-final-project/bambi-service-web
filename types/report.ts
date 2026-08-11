/**
 * 내 보고서 생성 상태 타입 (홈 [내 보고서] PREPARING 처리중 슬롯용).
 *
 * 본문·상세는 미연결이다 — 추후 service.reports 테이블/API(GET /reports/mine, status 포함)로 교체한다.
 * status 는 기존 보고서 생성 상태 어휘(PREPARING/READY/ERROR)를 따른다(별도 boolean isProcessing 을 만들지 않는다).
 */
export type ReportStatus = "PREPARING" | "READY" | "ERROR";

/**
 * 보고서가 어떤 방식으로 생성됐는지 — 아침 브리핑(정기)·온디맨드(요청)·온보딩(가입 직후 첫 리포트).
 *
 * 백엔드 `reportType` 필드와 값이 1:1인 **단일 어휘**다. 화면 문구 매핑은 `lib/report-type.ts`
 * (`getReportTypeLabel`) 한 곳에서만 하고, 여기에 프론트 전용 값을 새로 만들지 않는다.
 * 값을 모르거나 계약에 없는 문자열이 오면 종류를 추측하지 않고 미표시로 둔다.
 *
 * ⚠ `ONBOARDING` 은 **API 식별값**이다. 사용자에게는 항상 "첫 리포트"로만 보이며, 이 문자열
 * 자체를 화면에 노출하지 않는다(다른 두 값도 마찬가지 — 노출은 라벨 매핑을 반드시 거친다).
 */
export type ReportType = "MORNING_BRIEFING" | "ON_DEMAND" | "ONBOARDING";

/**
 * Service Pending으로 생성 진행 상태를 추적할 수 있는 종류. 온보딩 생성 소유권이 Service로
 * 이동하면서 세 종류 모두 PREPARING 슬롯에서 동일하게 추적한다.
 */
export type TrackableReportType = ReportType;

/** GET /api/reports/pending이 반환하는 활성 생성 상태. 종결 상태는 이 API에 포함되지 않는다. */
export type GenerationPendingStatus = "PENDING" | "RUNNING" | "PUBLISHING";

/** Service API GenerationPendingResponse와 1:1인 활성 생성 작업 DTO. */
export type GenerationPendingDto = {
  id: string;
  topic: string | null;
  contentType: string | null;
  reportType: TrackableReportType;
  status: GenerationPendingStatus;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
};

/** 내 보고서 1건의 생성 상태 요약. 처리중 여부는 status 로 파생한다(status === "PREPARING"). */
export type MyReport = {
  id: string;
  title: string;
  reportType: TrackableReportType;
  status: ReportStatus;
};

/* ============================================================================
 * 리포트(본문) API 계약 타입 — GET /api/reports/{publicId}
 * (bambi-service-api ReportController·ReportResponse.java·ReportService.java 실측,
 *  검증일 2026-08-03 · PR #25 도입 · PR #30 게스트/공개 열람 확장)
 *
 * - 권한: 내 리포트이거나 PUBLIC 카드가 참조하는 리포트만 열람된다. 부재·남의 비공개·
 *   UUID 형식 오류는 존재 노출 없이 전부 404(NOT_FOUND)다.
 * - 상태 필드 없음: 리포트는 발행(claim) 시점에 생성되므로 "존재 = 완료"다.
 *   생성 중(preparing) 상태는 이 API 에 존재하지 않는다 — 프론트가 만들지 않는다.
 * - body 는 agent 가 생성한 Markdown 원문(인용 참조 [P1]·[G1]·[L1] 포함 —
 *   bambi-agent-api report_builder_system.md 계약). DB 컬럼(TEXT)이 nullable 이라 null 방어.
 * - citations 는 카드의 sources 와 같은 발행 payload(PublishItem.citations)에서 저장된다
 *   (PublishProcessingService 실측) — 화면에서 둘 다 렌더하면 중복이므로 한쪽만 쓴다.
 *   카드 sources 와 리포트 citations 를 임의로 합산하지 않는다(둘은 같은 payload 다).
 * ========================================================================== */

/**
 * citation 1건 — title·url 이 각각 독립적으로 null 일 수 있고, 실제 응답에는
 * { "title": null, "url": null } 처럼 둘 다 비어 있는 항목도 존재한다.
 * 화면에 그대로 쓰지 말고 lib/adapters/report.ts 의 toReportCitations 로 정규화한다.
 */
export type ReportCitation = {
  title: string | null;
  url: string | null;
};

/** Agent가 실제 인용 출처에서 고른 리포트 상단 대표 이미지 계약. */
export type ReportCoverImage = {
  url: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  reference: string | null;
};

/**
 * GET /api/reports/{publicId} 성공 data — 서버 ReportResponse 와 1:1.
 * citations 는 서버 계약상 배열이지만 배열 아님/항목 null 까지 adapter 가 방어한다
 * (여기서 타입을 느슨하게 풀어 계약을 흐리지 않는다).
 */
export type ReportResponse = {
  publicId: string;
  title: string;
  summary: string | null;
  body: string | null;
  /** 적합한 출처 이미지가 없거나 구버전 응답이면 null 또는 필드 누락이다. */
  coverImage?: ReportCoverImage | null;
  citations: ReportCitation[];
  createdAt: string; // ISO-8601 (서버 OffsetDateTime)
  /**
   * 생성 방식(아침 브리핑·온디맨드). **아직 배포되지 않은 필드**라 optional 이다 — 서버가
   * 내려주기 시작하면 그대로 채워진다. 없거나 계약 밖 값이면 종류를 표시하지 않는다
   * (판정은 lib/report-type.ts 가 런타임에서 한다).
   */
  reportType?: ReportType | null;
};
