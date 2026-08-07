import { getReportTypeLabel } from "@/lib/report-type";

/**
 * 보고서 생성 종류 배지(`아침 브리핑` · `온디맨드` · `첫 리포트`) — 내 보고서 표면 공용.
 *
 * **표시하는 곳**: 홈 [내 보고서] 카드 · `/reports` 목록 · 내 카드 상세.
 * **표시하지 않는 곳**: 추천·팔로잉·공개 피드, 타인 프로필, 스크랩, 알림 목록.
 * 남의 보고서에 이 값을 붙이는 것은 계약에도 제품 방향에도 없다 — 호출부가 내 보고서
 * 맥락임을 확인한 자리에서만 렌더한다(상세는 소유자 판정을 통과한 경우에만).
 *
 * 값이 없거나(필드 미배포·null) 계약 밖 문자열이면 `getReportTypeLabel` 이 null 을 주고,
 * 이 컴포넌트는 **아무것도 렌더하지 않는다** — 빈 wrapper·여백도 남기지 않아 기존 레이아웃이
 * 그대로 유지된다. `미분류` 같은 대체 배지를 만들지 않고, API 원문 값(`ONBOARDING` 등)을
 * 화면에 노출하지도 않는다(모르는 것을 아는 척하지 않는다).
 *
 * 시각은 기존 `.kbadge` 토큰 계열을 그대로 쓴다(새 색·그림자·크기 토큰을 만들지 않는다).
 * 종류를 **색으로 구분하지 않고 문구로만** 구분한다 — 색각 이상 사용자에게도 동일하게 읽히고,
 * 배지가 제목보다 강조되지 않는다.
 *
 * size 는 이미 각 화면에 자리 잡은 메타 행의 리듬에 맞추기 위한 것이다. Tailwind 유틸리티가
 * 문자열 순서로 덮이지 않아 className 으로 크기를 겹쳐 주면 결과가 불안정하므로,
 * 충돌 없는 완성된 클래스 조합을 미리 정해 고른다.
 */
const SIZE_CLASS = {
  /** 홈 [내 보고서] 카드 메타 — 같은 줄 공개 배지(py-[2px]·11px)와 동일한 리듬. */
  card: "px-[9px] py-[2px] text-[11px]",
  /** /reports 목록 메타 — 행 전체가 h-[22px] 로 수직 중앙을 맞추는 구조. */
  archive: "h-[22px] px-2 text-[10.5px]",
} as const;

export function ReportTypeBadge({
  reportType,
  size = "card",
}: {
  reportType: unknown;
  size?: keyof typeof SIZE_CLASS;
}) {
  const label = getReportTypeLabel(reportType);
  if (label === null) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-border bg-background font-semibold whitespace-nowrap text-ink-mid ${SIZE_CLASS[size]}`}
    >
      {label}
    </span>
  );
}
