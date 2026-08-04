/**
 * 내 보고서 생성 상태 타입 (홈 [내 보고서] PREPARING 처리중 슬롯용).
 *
 * 본문·상세는 미연결이다 — 추후 service.reports 테이블/API(GET /reports/mine, status 포함)로 교체한다.
 * status 는 기존 보고서 생성 상태 어휘(PREPARING/READY/ERROR)를 따른다(별도 boolean isProcessing 을 만들지 않는다).
 */
export type ReportStatus = "PREPARING" | "READY" | "ERROR";

/**
 * 보고서 생성 유형 — 온디맨드(관심 자료 분석)·데일리(아침 브리핑) 구분용.
 * ⚠ Mock/VM 범위의 화면 구분값이다. 실제 API 계약(백엔드 필드명·값)으로 단정하지 않는다
 *   — service.reports 스키마 확정 시 어댑터에서 매핑한다.
 */
export type ReportKind = "ON_DEMAND" | "DAILY";

/** 내 보고서 1건의 생성 상태 요약. 처리중 여부는 status 로 파생한다(status === "PREPARING"). */
export type MyReport = {
  id: string;
  title: string;
  kind: ReportKind;
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
  citations: ReportCitation[];
  createdAt: string; // ISO-8601 (서버 OffsetDateTime)
};
