import { ERROR_CODES } from "@/constants/errors";
import { ApiError, apiGet } from "@/lib/api-client";
import { REPORT_REGISTRY, type ReportDetail } from "@/lib/mock/report";
import { isUuid } from "@/lib/utils";
import type { CardResponse } from "@/types/feed";
import type { ReportResponse } from "@/types/report";

/**
 * 리포트 상세 데이터 repository — 단일 seam.
 *
 * 세 경로가 공존한다:
 * - fetchReport(mock): 등록 mock id(REPORT_REGISTRY) 상세 — 서버가 미등록 id 를 404 로 거른 뒤
 *   레지스트리를 Promise 로 감싼다(회귀 유지용, 실 API 아님).
 * - fetchCardDetail(실): GET /api/cards/{publicId} — 실 UUID 카드 요약.
 * - fetchReportBody(실): GET /api/reports/{reportPublicId} — 카드 reportId 로 잇는 본문
 *   (2026-08-03 연결, service-api PR #25·#30 실측).
 */

/** 등록된 리포트 1건의 로드 결과. 전송 오류는 throw → 훅이 error 로 정규화한다. */
export type ReportResult =
  | { status: "ready"; report: ReportDetail; allowGuest: boolean }
  | { status: "preparing"; allowGuest: boolean };

/** mock 값을 Promise 로 감싸되 AbortSignal 을 존중한다(실 API 의 취소 계약을 미리 반영). */
function resolveAbortable<T>(value: T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return Promise.resolve(value);
}

/**
 * 등록된 id 의 리포트를 로드한다(mock). preparing 은 실 API content_status 에서만 발생한다.
 * 서버(reportRouteExists)가 미등록 id 를 이미 404 처리하므로 route 는 존재한다.
 */
export function fetchReport(id: string, signal?: AbortSignal): Promise<ReportResult> {
  const route = REPORT_REGISTRY[id];
  // 방어적: 서버 검증을 통과했는데도 없으면 전송 오류에 준해 reject(훅이 error 로 정규화).
  if (!route) return Promise.reject(new Error(`report route missing: ${id}`));
  const result: ReportResult = {
    status: "ready",
    report: route.report,
    allowGuest: route.kind === "public",
  };
  return resolveAbortable(result, signal);
}

/**
 * 실 카드 단건 조회 결과 — 화면 상태로 정규화한다.
 * 404(NOT_FOUND: 존재하지 않음/비소유/잘못된 UUID)는 notFound 결과로,
 * 그 외(401·500·네트워크)는 throw 하여 훅이 error 로 처리한다.
 */
export type CardDetailResult =
  | { status: "ready"; card: CardResponse }
  | { status: "notFound" };

/**
 * 실 UUID 카드 단건 상세 — GET /api/cards/{publicId}(인증·소유자 전용).
 * mock 상세(fetchReport)와 공존한다: mock id 는 위 함수, 실 UUID 는 이 함수를 쓴다.
 * 대외 식별자는 publicId(UUID)만 사용한다(내부 순번 id 금지).
 */
export async function fetchCardDetail(
  publicId: string,
  signal?: AbortSignal,
): Promise<CardDetailResult> {
  try {
    const card = await apiGet<CardResponse>(`/api/cards/${publicId}`, { signal });
    return { status: "ready", card };
  } catch (err) {
    // API 404(NOT_FOUND)는 오류가 아니라 화면 상태(notFound)로 정규화. 나머지는 훅 error 로 전달.
    if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
      return { status: "notFound" };
    }
    throw err;
  }
}

/**
 * 리포트 본문 단건 조회 결과 — 화면 상태로 정규화.
 * - none     : 연결된 본문 없음(요청 자체를 하지 않음). reportId 누락·null·빈 값·비 UUID 전부 여기.
 * - notFound : 실제로 요청한 뒤 서버가 404(NOT_FOUND)를 준 경우에만.
 * - throw    : 그 외(401·500·네트워크) → 훅이 error 로 처리한다.
 */
export type ReportBodyResult =
  | { status: "ready"; report: ReportResponse }
  | { status: "notFound" }
  | { status: "none" };

/**
 * reportId 런타임 정규화 — 요청을 보내도 되는 값인지 한 곳에서 판정한다.
 *
 * 배포 응답에서 undefined(필드 누락)·null·""·공백·비 UUID 문자열이 모두 관측될 수 있어
 * 타입만으로는 막지 못한다. 유효한 UUID 문자열일 때만 id 를 돌려주고, 그 외는 전부 null
 * (= "연결된 본문 없음")이다. card.publicId 같은 대체값을 끼워 넣지 않는다.
 */
export function normalizeReportId(reportId: string | null | undefined): string | null {
  if (typeof reportId !== "string") return null;
  const trimmed = reportId.trim();
  return isUuid(trimmed) ? trimmed : null;
}

/**
 * 리포트(본문) 단건 — GET /api/reports/{reportPublicId}
 * (실측: service-api ReportController·ReportService, PR #25·#30 · 검증일 2026-08-03).
 * 진입점은 CardResponse.reportId(= 리포트의 publicId, 내부 순번 id 아님).
 * 권한은 카드 visibility 를 따른다(내 리포트 or PUBLIC 카드가 참조하는 리포트).
 * 응답에 상태 필드가 없다(존재 = 완료) — preparing 상태를 만들지 않는다.
 *
 * 호출부 실수로 잘못된 값이 들어와도 여기서 먼저 막는다: /api/reports/undefined ·
 * /api/reports/null · 빈 id · 비 UUID 요청은 네트워크로 나가지 않고 none 으로 끝난다.
 */
export async function fetchReportBody(
  reportPublicId: string | null | undefined,
  signal?: AbortSignal,
): Promise<ReportBodyResult> {
  const id = normalizeReportId(reportPublicId);
  if (id === null) return { status: "none" }; // 요청 없음 — notFound 가 아니다

  try {
    const report = await apiGet<ReportResponse>(`/api/reports/${encodeURIComponent(id)}`, {
      signal,
    });
    return { status: "ready", report };
  } catch (err) {
    if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
      return { status: "notFound" };
    }
    throw err;
  }
}
