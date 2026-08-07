/**
 * 온디맨드 보고서 생성 API 계약 타입 — POST /api/reports/generate.
 *
 * 계약은 확정됐고 Service 코드 반영을 기다리는 상태다(2026-08-06 확정). 현재 배포본은 body 를
 * 받지 않고 서버가 대표 Wiki 태그를 골라 생성하지만, **프론트는 확정 계약만 구현한다** —
 * body 미지정·공백 topic 으로 서버가 태그를 고르게 하는 하위 호환 폴백을 만들지 않는다.
 */

/**
 * 요청 body. `topic` 은 **현재 Service 에 저장된 내 관심사(GET /api/interests, source=USER)의
 * 이름**이어야 한다. Wiki 태그(GET /api/wiki/tags)는 아직 관심사가 아니므로 그대로 보내면
 * 서버가 404(INTEREST_NOT_FOUND)로 거절한다 — 사용자가 다른 화면에서 관심사로 먼저 추가해야 한다.
 */
export type GenerateReportRequest = {
  topic: string;
};

/**
 * 성공(HTTP 202) data — **"생성 요청이 서버에 접수됨"만** 의미한다.
 * 생성 진행·완료 여부는 이 응답으로 알 수 없다(Pending 조회는 별도 범위).
 *
 * - status: 서버 문자열을 그대로 담는다. 관측값이 하나뿐이어도 임의 enum 으로 좁히지 않는다.
 * - id: Service 가 보장하는 접수 식별자. 보고서/카드의 publicId 가 아니므로 `/report/{id}` 같은
 *   경로에 재사용하지 않는다.
 * - agentJobId: agent 식별자. 202 body 파싱 실패 시 null 이 될 수 있어 **화면 키로 쓰지 않는다**.
 */
export type GenerateReportResponse = {
  status: string;
  id: string;
  agentJobId: string | null;
};
