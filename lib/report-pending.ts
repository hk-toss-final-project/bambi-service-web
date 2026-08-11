import type {
  GenerationPendingDto,
  GenerationPendingStatus,
  TrackableReportType,
} from "@/types/report";

export const REPORT_PENDING_PATH = "/api/reports/pending";
export const ACTIVE_PENDING_POLL_MS = 5_000;
export const IDLE_PENDING_POLL_MS = 30_000;

export type PendingIdSnapshot = ReadonlySet<string> | null;

export type PendingSuccessObservation = {
  snapshot: ReadonlySet<string>;
  shouldRefreshFeed: boolean;
  nextIntervalMs: number | null;
};

export type PendingFailureObservation = {
  snapshot: PendingIdSnapshot;
  shouldRefreshFeed: false;
  nextIntervalMs: number | null;
};

/** 홈 처리중 슬롯에 노출할 유형별 제목. API 식별값이나 서버 placeholder는 노출하지 않는다. */
export function getPreparingReportTitle(title: string, reportType: TrackableReportType): string {
  if (reportType === "MORNING_BRIEFING") return "오늘의 아침 브리핑을 생성하고 있어요";
  if (reportType === "ONBOARDING") return "첫 리포트를 생성하고 있어요";
  return `${title} 보고서`;
}

/** 실제 Pending DTO의 필수 필드와 활성 상태 enum을 런타임에서 검증한다. */
export function isGenerationPendingDto(value: unknown): value is GenerationPendingDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.trim() !== "" &&
    isNullableString(item.topic) &&
    isNullableString(item.contentType) &&
    isTrackableReportType(item.reportType) &&
    isGenerationPendingStatus(item.status) &&
    typeof item.createdAt === "string" &&
    item.createdAt.trim() !== "" &&
    typeof item.updatedAt === "string" &&
    item.updatedAt.trim() !== "" &&
    isNullableString(item.errorCode)
  );
}

/** 성공 응답끼리만 비교한다. 동일 ID의 상태 변경은 완료가 아니며, ID 제거만 피드 갱신 신호다. */
export function observePendingSuccess(
  previous: PendingIdSnapshot,
  reports: readonly GenerationPendingDto[],
): PendingSuccessObservation {
  const snapshot = new Set(reports.map((report) => report.id));
  const shouldRefreshFeed =
    previous !== null && [...previous].some((pendingId) => !snapshot.has(pendingId));
  return {
    snapshot,
    shouldRefreshFeed,
    nextIntervalMs: reports.length > 0 ? ACTIVE_PENDING_POLL_MS : IDLE_PENDING_POLL_MS,
  };
}

/** 일시 오류는 빈 성공 응답이 아니다. 이전 스냅샷을 보존하고 활성 여부에 맞춰 재시도한다. */
export function observePendingFailure(previous: PendingIdSnapshot): PendingFailureObservation {
  return {
    snapshot: previous,
    shouldRefreshFeed: false,
    nextIntervalMs:
      previous !== null && previous.size > 0 ? ACTIVE_PENDING_POLL_MS : IDLE_PENDING_POLL_MS,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTrackableReportType(value: unknown): value is TrackableReportType {
  return value === "MORNING_BRIEFING" || value === "ON_DEMAND" || value === "ONBOARDING";
}

function isGenerationPendingStatus(value: unknown): value is GenerationPendingStatus {
  return value === "PENDING" || value === "RUNNING" || value === "PUBLISHING";
}
