import { fetchMemberFeed } from "@/lib/repositories/feed";
import { normalizeReportId } from "@/lib/repositories/report";
import { isUuid } from "@/lib/utils";

const REPORT_PATH_PREFIX = "/report/";

/**
 * 알림 targetPath 해석 실패 원인 — 사용자 문구 매핑이 케이스별로 달라
 * (feed 조회 자체가 실패했는지, feed는 받았지만 대상이 없는지) 구분해서 반환한다.
 *
 * - invalid-path: targetPath 가 허용 형식(`/report/{UUID}`)이 아님 — 외부 URL·protocol-relative·
 *   `javascript:`·query/hash 포함·비 UUID 전부 여기로 온다.
 * - feed-error: GET /api/feed 요청 자체가 실패함(네트워크·서버 오류) — 재시도로 해결될 수 있다.
 * - not-found: feed 조회는 성공했지만 어떤 카드도 publicId/reportId 로 이 UUID 와 일치하지 않음.
 */
export type NotificationTargetErrorKind = "invalid-path" | "feed-error" | "not-found";

export type NotificationTargetResult =
  | { ok: true; cardPublicId: string }
  | { ok: false; error: NotificationTargetErrorKind };

/**
 * targetPath 가 정확히 `/report/{UUID}` 형태일 때만 UUID 를 반환한다.
 * query·hash·추가 세그먼트·외부 URL·protocol-relative·`javascript:` 등은 전부 null.
 */
export function parseReportTargetUuid(targetPath: string): string | null {
  if (!targetPath.startsWith(REPORT_PATH_PREFIX)) return null;
  const rest = targetPath.slice(REPORT_PATH_PREFIX.length);
  if (rest === "" || rest.includes("/") || rest.includes("?") || rest.includes("#")) return null;
  return isUuid(rest) ? rest : null;
}

/**
 * 알림의 target UUID를 실제 카드 publicId 로 해석한다.
 *
 * 백엔드가 아직 report.publicId 기반 targetPath 를 저장하므로(§11 확인: card.getPublicId() 기반
 * 수정·backfill 없음), 신규·기존 알림을 같은 순서로 시도한다 — 컴포넌트는 이 함수만 호출하고
 * 직접 fetch 하지 않는다:
 *
 * 1. card.publicId === target UUID → 이미 올바른 cardPublicId(향후 백엔드 수정 이후 경로)
 * 2. card.reportId === target UUID → 기존 잘못된 알림(리포트 publicId) 이므로 card.publicId 로 교정
 * 3. 둘 다 없음 → not-found
 */
export async function resolveNotificationTarget(
  targetPath: string,
  signal?: AbortSignal,
): Promise<NotificationTargetResult> {
  const targetUuid = parseReportTargetUuid(targetPath);
  if (targetUuid === null) return { ok: false, error: "invalid-path" };

  let cards;
  try {
    cards = await fetchMemberFeed(signal);
  } catch {
    return { ok: false, error: "feed-error" };
  }

  const direct = cards.find((card) => card.publicId === targetUuid);
  if (direct) return { ok: true, cardPublicId: direct.publicId };

  const legacy = cards.find((card) => normalizeReportId(card.reportId) === targetUuid);
  if (legacy) return { ok: true, cardPublicId: legacy.publicId };

  return { ok: false, error: "not-found" };
}
