import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { CardDetailScreen } from "@/components/report/card-detail-screen";
import { ERROR_MESSAGES } from "@/constants/errors";
import type { CardResponse } from "@/types/feed";
import type { ReportResponse } from "@/types/report";

import { server } from "../setup/msw-server";
import { renderWithProviders } from "../setup/render";

/**
 * 보고서(카드) 상세 — 조회 성공·실패 대표 테스트.
 *
 * 대상 선택 이유: `/report/{UUID}` 상세는 게스트에게 열려 있어(권한 = 내 카드 or PUBLIC)
 * **토큰·라우터를 흉내 내지 않고도** 실제 화면 컴포넌트를 그대로 렌더할 수 있는 유일한 P0 흐름이다.
 * 토큰이 없으면 AuthProvider 가 `/api/auth/me` 를 부르지 않고 바로 guest 로 확정하므로
 * 이 테스트가 거치는 네트워크는 상세가 실제로 쓰는 두 요청뿐이다.
 *
 * 검증 대상은 "사용자가 무엇을 보게 되는가"다 — 클래스명·내부 상태·소스 문자열은 보지 않는다.
 */
const CARD_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";

const CARD_ENDPOINT = `http://localhost/api/cards/${CARD_ID}`;
const REPORT_ENDPOINT = `http://localhost/api/reports/${REPORT_ID}`;

/** 게스트가 볼 수 있는 공개 카드 1건 — 필드는 CardResponse 계약 그대로다. */
const PUBLIC_CARD: CardResponse = {
  publicId: CARD_ID,
  reportId: REPORT_ID,
  title: "반도체 공급망에 생긴 이번 주 변화",
  summary: "장비 반입 지연이 이번 분기 출하 계획에 미치는 영향 요약.",
  whyForYou: "저장하신 반도체 자료와 겹치는 주제예요.",
  visibility: "PUBLIC",
  author: { publicId: "33333333-3333-4333-8333-333333333333", username: "bambi", displayName: "밤비" },
  likeCount: 3,
  liked: false,
  scrapped: false,
  sources: [{ title: "예시 출처", url: "https://example.com/article" }],
  createdAt: "2026-08-11T23:10:00Z",
};

/** 카드가 가리키는 본문 — 상세는 카드 요약 아래에 이 Markdown 을 렌더한다. */
const REPORT_BODY: ReportResponse = {
  publicId: REPORT_ID,
  title: PUBLIC_CARD.title,
  summary: PUBLIC_CARD.summary,
  body: "## 이번 주 요점\n\n장비 반입 일정이 2주 밀렸습니다.",
  citations: [{ title: "예시 출처", url: "https://example.com/article" }],
  createdAt: PUBLIC_CARD.createdAt,
};

/** 공통 응답 봉투(§3) — 성공. */
function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data, error: null });
}

/**
 * 공통 응답 봉투(§3) — 실패. message 에는 **서버 원문**을 넣는다.
 * 어떤 코드에서도 이 원문이 화면에 새지 않아야 한다(§2 로깅 전용).
 */
function fail(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, error: { code, message } }, { status });
}

/** 화면이 카드 조회 실패로 들어갈 때까지 기다린다 — 오류 화면의 제목은 코드와 무관하게 같다. */
async function renderCardError() {
  renderWithProviders(<CardDetailScreen publicId={CARD_ID} origin={{ token: "feed" }} />);
  return screen.findByText("카드를 불러오지 못했어요");
}

describe("보고서 상세 화면", () => {
  test("조회에 성공하면 보고서 제목과 본문을 보여준다", async () => {
    server.use(
      http.get(CARD_ENDPOINT, () => ok(PUBLIC_CARD)),
      http.get(REPORT_ENDPOINT, () => ok(REPORT_BODY)),
    );

    renderWithProviders(<CardDetailScreen publicId={CARD_ID} origin={{ token: "feed" }} />);

    // 로딩이 끝나면 사용자는 제목(문서 제목 수준의 heading)과 본문을 본다.
    expect(
      await screen.findByRole("heading", { level: 1, name: PUBLIC_CARD.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText("장비 반입 일정이 2주 밀렸습니다.")).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_CARD.summary)).toBeInTheDocument();
  });

  test("조회에 실패하면 오류 안내와 다시 시도 버튼을 보여준다", async () => {
    server.use(
      http.get(CARD_ENDPOINT, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            // 서버 원문 message 는 화면에 노출되지 않아야 한다(§2) — 아래에서 확인한다.
            error: { code: "INTERNAL_ERROR", message: "db connection refused" },
          },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<CardDetailScreen publicId={CARD_ID} origin={{ token: "feed" }} />);

    expect(await screen.findByText("카드를 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText(/db connection refused/)).not.toBeInTheDocument();
  });
});

/**
 * FE-QA-001 — 실패 원인별 안내 구분.
 *
 * 결함: `useAsyncData` 가 오류의 `error.code` 를 버리고 status="error" 만 남겨서, 권한 없음·AI 장애·
 * 일반 500·네트워크 끊김이 화면에서 **전부 같은 문구**로 보였다. 원인이 보존되는지를 사용자가 읽는
 * 문구로 검증한다(훅 내부 상태를 들여다보지 않는다).
 *
 * 문구는 테스트에 다시 적지 않고 `ERROR_MESSAGES`(§4 단일 소스)를 참조한다 —
 * 여기에 문자열을 복사하면 매핑이 바뀌어도 테스트가 계속 통과해 버린다.
 */
describe("보고서 상세 화면 — 실패 원인별 안내", () => {
  test("403 FORBIDDEN 이면 권한 안내를 보여준다", async () => {
    server.use(http.get(CARD_ENDPOINT, () => fail("FORBIDDEN", "access denied for user 42", 403)));

    expect(await renderCardError()).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.FORBIDDEN)).toBeInTheDocument();
    // 일반 오류 문구로 뭉뚱그려지지 않는다 — 이게 이 결함의 핵심이다.
    expect(screen.queryByText(ERROR_MESSAGES.INTERNAL_ERROR)).not.toBeInTheDocument();
    expect(screen.queryByText(/access denied for user 42/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("503 AGENT_UNAVAILABLE 이면 AI 처리 전용 안내를 보여준다", async () => {
    server.use(
      http.get(CARD_ENDPOINT, () => fail("AGENT_UNAVAILABLE", "agent pool exhausted", 503)),
    );

    expect(await renderCardError()).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.AGENT_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(ERROR_MESSAGES.FORBIDDEN)).not.toBeInTheDocument();
    expect(screen.queryByText(/agent pool exhausted/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("일반 500 이면 화면의 기존 일반 오류 안내를 그대로 보여준다", async () => {
    server.use(http.get(CARD_ENDPOINT, () => fail("INTERNAL_ERROR", "npe at ReportService", 500)));

    expect(await renderCardError()).toBeInTheDocument();
    // 원인이 특정되지 않는 코드는 화면이 원래 쓰던 안내를 유지한다(문구 변경 없음).
    expect(
      screen.getByText("일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
    expect(screen.queryByText(ERROR_MESSAGES.FORBIDDEN)).not.toBeInTheDocument();
    expect(screen.queryByText(/npe at ReportService/)).not.toBeInTheDocument();
  });

  test("코드 없는 네트워크 오류면 안전한 기존 fallback 안내를 보여준다", async () => {
    // 응답 자체가 오지 않는다 → 봉투도 error.code 도 없다.
    server.use(http.get(CARD_ENDPOINT, () => HttpResponse.error()));

    expect(await renderCardError()).toBeInTheDocument();
    expect(
      screen.getByText("일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("오류 뒤 다시 시도를 누르면 재조회해 정상 화면으로 돌아온다", async () => {
    server.use(http.get(CARD_ENDPOINT, () => fail("FORBIDDEN", "access denied", 403)));

    expect(await renderCardError()).toBeInTheDocument();

    // 권한이 회복된 뒤의 재시도 — refetch 동작이 그대로인지 확인한다.
    server.use(
      http.get(CARD_ENDPOINT, () => ok(PUBLIC_CARD)),
      http.get(REPORT_ENDPOINT, () => ok(REPORT_BODY)),
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: PUBLIC_CARD.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(ERROR_MESSAGES.FORBIDDEN)).not.toBeInTheDocument();
  });
});
