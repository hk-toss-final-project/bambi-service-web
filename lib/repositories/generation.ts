import { ERROR_CODES, FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiPost } from "@/lib/api-client";
import type { GenerateReportRequest, GenerateReportResponse } from "@/types/generation";

/**
 * 온디맨드 보고서 생성 repository — 화면 훅과 Service API 사이의 단일 seam.
 *
 * 인증 필수. Bearer 부착·envelope 해석·401 처리·error.code 정규화는 공통 api-client 가 한다(§3·§5·§8).
 * 훅이 authenticated 에서만 호출하므로 여기서 인증 상태를 다시 판단하지 않는다.
 */
const GENERATE_PATH = "/api/reports/generate";

/**
 * 온디맨드 보고서 생성 요청 — POST /api/reports/generate(인증, 202 Accepted).
 *
 * **항상 `{ topic }` 을 보낸다.** body 없는 호출·빈 topic 은 서버가 대표 Wiki 태그를 대신
 * 고르는 경로라, 사용자가 화면에서 선택한 관심사와 다른 주제로 생성될 수 있다 → 여기서 막는다.
 *
 * 성공은 **접수 확인일 뿐**이다(생성 완료 아님). 그래서 응답에서 확인하는 것도 "접수 식별자가
 * 실제로 왔는가" 하나다 — `id` 가 비어 있으면 접수됐다고 단정하지 않고 오류로 올린다
 * (가짜 성공 반환 금지). `agentJobId` 는 nullable 참고값이라 검증 대상이 아니다.
 *
 * @throws ApiError VALIDATION_ERROR(status 0) — topic 이 공백이라 **네트워크 요청 없이** 거절.
 *         status 0 은 "HTTP 요청이 나가지 않았음"을 뜻한다(응답 검증 실패에 200 을 쓰는 것과 같은 규율).
 */
export async function generateReport(
  request: GenerateReportRequest,
  signal?: AbortSignal,
): Promise<GenerateReportResponse> {
  const topic = request.topic.trim();
  if (topic === "") {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, `blank topic for ${GENERATE_PATH}`, 0);
  }

  const data = await apiPost<GenerateReportResponse | null>(GENERATE_PATH, { topic }, { signal });
  if (!data || typeof data.id !== "string" || data.id.trim() === "") {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid generate payload for ${GENERATE_PATH}`, 202);
  }
  return data;
}
