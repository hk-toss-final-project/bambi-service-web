import type { ReportType } from "@/types/report";

/**
 * 보고서 생성 종류(reportType) 판정·문구 매핑 — **단일 소스**.
 *
 * `constants/errors.ts` 가 에러코드 문구를 한 곳에 모으는 것과 같은 규율이다. 화면마다
 * `reportType === "ON_DEMAND"` 조건문과 라벨 문자열을 다시 쓰지 않는다.
 *
 * 두 함수 모두 입력이 `unknown` 이다. 타입상으로는 `ReportType | null` 이 오게 돼 있지만
 * 이 값은 **아직 배포되지 않은 서버 필드**라서, 실제로는 필드 누락(undefined)·null·빈 문자열·
 * 계약에 없는 문자열이 모두 도달할 수 있다. 역직렬화 결과를 그대로 믿지 않고 여기서 한 번
 * 좁힌다 — 그래야 알 수 없는 값이 화면에 원문으로 새거나 런타임 오류가 되지 않는다.
 */
const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  MORNING_BRIEFING: "아침 브리핑",
  ON_DEMAND: "온디맨드",
  // API 식별값은 ONBOARDING 이지만 사용자에게는 "첫 리포트"로만 보인다(원문 노출 금지).
  ONBOARDING: "첫 리포트",
};

/** 알려진 reportType 이면 그 값을, 아니면 null. 모르는 값을 한쪽으로 단정하지 않는다. */
export function toReportType(value: unknown): ReportType | null {
  return typeof value === "string" && Object.hasOwn(REPORT_TYPE_LABEL, value)
    ? (value as ReportType)
    : null;
}

/**
 * 화면 표시 문구. 알 수 없는 값·없는 값은 **null** 이고, 호출부는 그때 아무것도 렌더하지 않는다.
 * `UNKNOWN` 같은 임시 배지를 만들거나 API 원문 값을 그대로 노출하지 않는다.
 */
export function getReportTypeLabel(value: unknown): string | null {
  const type = toReportType(value);
  return type === null ? null : REPORT_TYPE_LABEL[type];
}
