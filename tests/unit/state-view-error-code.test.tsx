import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { StateView } from "@/components/ui/state-view";
import { ERROR_CODES, ERROR_MESSAGES } from "@/constants/errors";

/**
 * 공통 StateView — 오류 코드 → 설명 문구 해석 규칙(FE-QA-001).
 *
 * 해석 로직은 **StateView 한 곳에만** 있으므로 코드별 문구도 여기서 한 번만 고정한다.
 * 화면 테스트는 "코드가 화면까지 전달되는가"만 보면 되고, 문구 매핑을 화면마다 복제하지 않는다.
 *
 * 문구 리터럴을 여기 적지 않고 ERROR_MESSAGES(§4 단일 소스)를 참조하는 이유는,
 * 복사해 두면 매핑이 바뀌어도 테스트가 계속 통과해 버리기 때문이다.
 */
const FALLBACK_DESCRIPTION = "일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요.";

function renderStateView(errorCode?: (typeof ERROR_CODES)[keyof typeof ERROR_CODES]) {
  return render(
    <StateView
      role="alert"
      title="불러오지 못했어요"
      description={FALLBACK_DESCRIPTION}
      errorCode={errorCode}
      actions={[{ label: "다시 시도", onClick: () => {}, variant: "primary" }]}
    />,
  );
}

describe("StateView — 오류 코드별 설명 문구", () => {
  test("원인이 특정되는 코드는 공통 문구로 대체한다", () => {
    // 코드마다 서로 다른 문구가 나와야 한다 — 이게 FE-QA-001 의 본질이다.
    for (const code of [
      ERROR_CODES.FORBIDDEN,
      ERROR_CODES.AGENT_UNAVAILABLE,
      ERROR_CODES.NOT_FOUND,
      ERROR_CODES.AUTH_INVALID_TOKEN,
    ] as const) {
      const { unmount } = renderStateView(code);
      expect(screen.getByText(ERROR_MESSAGES[code])).toBeInTheDocument();
      // 호출부의 일반 문구로 뭉뚱그려지지 않는다.
      expect(screen.queryByText(FALLBACK_DESCRIPTION)).not.toBeInTheDocument();
      unmount();
    }
  });

  test("일반 오류(INTERNAL_ERROR)는 호출부가 준 기존 설명을 유지한다", () => {
    renderStateView(ERROR_CODES.INTERNAL_ERROR);
    expect(screen.getByText(FALLBACK_DESCRIPTION)).toBeInTheDocument();
  });

  test("코드가 없으면(네트워크 오류 등) 호출부가 준 기존 설명을 유지한다", () => {
    renderStateView(undefined);
    expect(screen.getByText(FALLBACK_DESCRIPTION)).toBeInTheDocument();
  });

  test("코드가 있어도 제목과 액션은 바뀌지 않는다", () => {
    renderStateView(ERROR_CODES.FORBIDDEN);
    expect(screen.getByText("불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("오류 코드가 없는 일반 상태(Empty 등)는 설명을 그대로 렌더한다", () => {
    render(<StateView title="아직 없어요" description="첫 자료를 추가해 보세요." />);
    expect(screen.getByText("첫 자료를 추가해 보세요.")).toBeInTheDocument();
  });
});
