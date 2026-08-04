import { normalizeHttpUrl, normalizeText } from "@/lib/normalize";
import type { ReportCitation, ReportResponse } from "@/types/report";

/**
 * ReportResponse(API DTO) → 화면에서 쓸 수 있는 값으로 정규화한다.
 *
 * 실제 응답의 citation 은 { "title": null, "url": null } 처럼 두 필드가 모두 비어 올 수 있고,
 * citations 배열 자체가 누락될 수도 있다. 화면이 값 유무를 매번 따지지 않도록 여기서 한 번만
 * 정리하고, 없는 값은 만들지 않는다(가짜 URL·가짜 출처·가짜 통계 금지).
 */

/** 정규화된 citation 1건. null 은 "그 값이 없음"이며, 화면은 null 필드를 렌더하지 않는다. */
export type ReportCitationVM = {
  /** 표시용 제목. 없으면 null(문자열 "null" 같은 값을 만들지 않는다). */
  title: string | null;
  /** http/https 인 경우에만 채운다 — 그 외 스킴은 외부 링크로 쓰지 않는다. */
  url: string | null;
};

/**
 * citations 정규화 — 제목·URL 이 모두 없는 citation 은 제거한다(빈 껍데기 출처 금지).
 * 제목만 있는 citation 은 링크 없는 텍스트 출처로 남고, URL 만 있는 citation 은 URL 을 제목 자리에
 * 쓰지 않고 title=null 로 둔다(표시 규칙은 화면이 정한다).
 * 출처 개수는 이 함수의 결과 길이로 센다 — raw citations.length 를 쓰지 않는다.
 */
export function toReportCitations(
  citations: readonly (ReportCitation | null | undefined)[] | null | undefined,
): ReportCitationVM[] {
  if (!Array.isArray(citations)) return [];
  const normalized: ReportCitationVM[] = [];
  for (const citation of citations) {
    if (citation === null || typeof citation !== "object") continue;
    const title = normalizeText(citation.title);
    const url = normalizeHttpUrl(citation.url);
    if (title === null && url === null) continue; // 표시할 값이 없는 citation 은 제외
    normalized.push({ title, url });
  }
  return normalized;
}

/**
 * 리포트 갱신 시각 표시 문자열 — 파싱 실패 시 빈 문자열(호출부가 해당 행을 숨긴다).
 * 카드 상세는 인증 확정 후 클라이언트에서만 렌더되므로(SSR 없음) 로컬 타임존 하이드레이션
 * 불일치 위험은 없다(lib/adapters/card.ts 와 같은 전제).
 */
const UPDATED_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatReportUpdatedAt(iso: string | null | undefined): string {
  if (typeof iso !== "string") return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return ""; // 임의 값 생성 금지
  return UPDATED_AT_FORMAT.format(new Date(ts));
}

/** 우측 rail 이 쓰는 값 — 없는 값은 null/"" 로 두고, 화면이 해당 행을 숨긴다. */
export type ReportRailVM = {
  citationCount: number;
  updatedAtLabel: string;
};

export function toReportRailVM(report: ReportResponse): ReportRailVM {
  return {
    citationCount: toReportCitations(report.citations).length,
    updatedAtLabel: formatReportUpdatedAt(report.createdAt),
  };
}
