import { ERROR_CODES, FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiGet, apiPost, apiPut, request } from "@/lib/api-client";
import type { InterestDto, InterestSelection } from "@/types/interest";

/**
 * 관심사 repository — 화면 훅과 Service API 사이의 단일 seam.
 *
 * 실측 계약 (bambi-service-api `interest/`, api-smoke-test.http #19~#23, 확인일 2026-07-30):
 * - GET    /api/interests       → InterestDto[] (createdAt desc, soft delete 제외)
 * - POST   /api/interests {name} → 201 + 생성된 InterestDto (source 항상 USER)
 * - DELETE /api/interests/{id}  → 200 (soft delete)
 * - PUT(rename) 은 온보딩에서 쓰지 않는다.
 * - 이름 중복 → 409 DUPLICATE_RESOURCE ("이미 등록한 관심사입니다") · 소유자 불일치/없음 → 404 NOT_FOUND.
 * - 일괄 저장 endpoint 는 없다 → 교체는 topic 단위 DELETE/POST 로 수행한다(replaceUserInterests).
 *
 * 모든 요청은 인증 필수 — Bearer 부착·envelope 해석·401 처리는 공통 api-client 가 한다(§3·§5·§8).
 * 훅이 authenticated 에서만 호출하므로 여기서 인증 상태를 다시 판단하지 않는다.
 */
const INTERESTS_PATH = "/api/interests";

/**
 * 내 관심사 목록 — **source=USER 만** 반환한다.
 * agent 추론 관심사(INFERRED)는 온보딩 편집 대상이 아니다(/api/wiki/tags 별개 도메인).
 * 정상 빈 배열(신규 사용자)은 오류가 아니라 "선택 0개에서 시작"이다.
 */
export async function fetchUserInterests(signal?: AbortSignal): Promise<InterestDto[]> {
  const data = await apiGet<InterestDto[] | null>(INTERESTS_PATH, { signal });
  if (!Array.isArray(data)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid interests payload for ${INTERESTS_PATH}`, 200);
  }
  return data.filter((interest) => interest.source === "USER");
}

/** 관심사 1건 생성. taxonomy 선택은 안정 ID를, 직접 추가는 name만 보낸다. */
export function createInterest(
  input: string | InterestSelection,
  signal?: AbortSignal,
): Promise<InterestDto> {
  const selection = typeof input === "string" ? { name: input } : input;
  return apiPost<InterestDto>(INTERESTS_PATH, selection, { signal });
}

/** 기존 같은 이름의 직접 관심사를 taxonomy 선택으로 승격할 때 메타데이터를 갱신한다. */
export function updateInterest(
  id: number,
  selection: InterestSelection,
  signal?: AbortSignal,
): Promise<InterestDto> {
  return apiPut<InterestDto>(`${INTERESTS_PATH}/${id}`, selection, { signal });
}

/** 관심사 1건 삭제 (soft delete). */
export async function deleteInterest(id: number, signal?: AbortSignal): Promise<void> {
  await request<null>(`${INTERESTS_PATH}/${id}`, { method: "DELETE", signal });
}

/**
 * 선택 결과를 서버 상태로 동기화 — 온보딩 저장·"다시 고르기" 재저장 공통 경로.
 *
 * 일괄 endpoint 가 없으므로 diff 를 topic 단위로 반영한다. **추가(POST)를 삭제(DELETE)보다 먼저**
 * 수행한다 — 반대로 하면 삭제 후 생성이 중간에 실패했을 때 기존 관심사가 이미 지워져
 * 사용자 데이터가 유실된 상태로 남는다(추가 먼저면 실패 시점에도 기존 값은 전부 보존).
 * 1) 선택됐는데 current 에 없는 것 → POST. 이미 존재(DUPLICATE_RESOURCE)하면
 *    목표 상태(있음)가 이미 달성된 것이므로 성공으로 취급한다.
 * 2) current(USER)에 있는데 선택 해제된 것 → DELETE. 이미 사라진 경우(NOT_FOUND)는
 *    목표 상태(없음)가 이미 달성된 것이므로 성공으로 취급한다.
 *    → 부분 실패 후 재시도해도 같은 호출로 수렴한다(멱등).
 * 3) 마지막에 GET 으로 서버 확정본을 다시 읽는다.
 * 4) 호출부가 이 확정본 ID를 선택 순서대로 `/api/onboarding/complete`에 보내 컨텍스트 동기화와
 *    리포트 생성을 한 번에 완료한다.
 *
 * 그 외 오류(VALIDATION_ERROR·INTERNAL_ERROR·네트워크)는 그대로 throw — 호출부가 선택을 유지한 채
 * 오류를 안내하고 재시도를 받는다. 관심사 저장은 저장일 뿐, 보고서 생성을 트리거하지 않는다.
 */
export async function replaceUserInterests(
  selections: InterestSelection[],
  current: InterestDto[],
): Promise<InterestDto[]> {
  const target = new Set(selections.map((selection) => selection.name));
  const existing = new Map(current.map((interest) => [interest.name, interest]));

  for (const selection of selections) {
    const saved = existing.get(selection.name);
    if (
      saved &&
      saved.taxonomyVersion === (selection.taxonomyVersion ?? null) &&
      saved.topicId === (selection.topicId ?? null)
    ) {
      continue;
    }
    try {
      if (saved) await updateInterest(saved.id, selection);
      else await createInterest(selection);
    } catch (err) {
      if (!(err instanceof ApiError && err.code === ERROR_CODES.DUPLICATE_RESOURCE)) throw err;
    }
  }

  for (const interest of current) {
    if (target.has(interest.name)) continue;
    try {
      await deleteInterest(interest.id);
    } catch (err) {
      if (!(err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND)) throw err;
    }
  }

  return fetchUserInterests();
}
