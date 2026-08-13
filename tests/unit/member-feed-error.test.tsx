import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MemberFeed } from "@/components/home/member-feed";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/constants/auth";
import { ERROR_MESSAGES } from "@/constants/errors";
import { useMemberFeed } from "@/hooks/use-member-feed";
import type { User } from "@/types/auth";

import { server } from "../setup/msw-server";
import { renderWithProviders } from "../setup/render";

/**
 * 홈 로그인 피드(`GET /api/feed`) — QA 에서 403 이 재현된 원래 결함 경로.
 *
 * 대상 선택 이유: FE-QA-001 이 처음 보고된 화면이고, `useAsyncData → useMemberFeed → MemberFeed`
 * 라는 공통 읽기 경로를 인증 상태까지 포함해 그대로 통과시키는 화면이다.
 *
 * 여기서 검증하는 건 **코드가 화면까지 전달되는가**다. 코드별 문구 매핑 자체는 공통
 * `state-view-error-code.test.tsx` 가 한 번만 고정하므로 화면마다 중복 검증하지 않는다.
 */
const ME_ENDPOINT = "http://localhost/api/auth/me";
const FEED_ENDPOINT = "http://localhost/api/feed";

const ME: User = {
  id: 1,
  email: "qa@bambi.test",
  displayName: "밤비",
  roles: ["USER"],
};

function ok<T>(data: T) {
  return HttpResponse.json({ success: true, data, error: null });
}

/** 공통 실패 봉투 — message 에는 서버 원문을 넣어 화면에 새지 않는지 확인한다(§2). */
function fail(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, data: null, error: { code, message } }, { status });
}

/**
 * 로그인 상태에서 홈 피드를 렌더한다. 상태는 실제 훅이 만들고, 화면은 실제 컴포넌트가 그린다
 * (훅 내부를 들여다보지 않고 사용자가 읽는 문구로만 확인하기 위해서다).
 */
function HomeFeedHarness() {
  return <MemberFeed feed={useMemberFeed()} />;
}

async function renderFeedError() {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, "test-token");
  server.use(http.get(ME_ENDPOINT, () => ok(ME)));
  renderWithProviders(<HomeFeedHarness />);
  return screen.findByText("내 보고서를 불러오지 못했어요");
}

describe("홈 로그인 피드 — 실패 원인별 안내", () => {
  test("403 FORBIDDEN 이면 권한 안내를 보여준다", async () => {
    server.use(http.get(FEED_ENDPOINT, () => fail("FORBIDDEN", "forbidden for user 1", 403)));

    expect(await renderFeedError()).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.FORBIDDEN)).toBeInTheDocument();
    // 결함 재현 지점: 예전에는 아래 일반 문구로 뭉뚱그려졌다.
    expect(
      screen.queryByText("일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/forbidden for user 1/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("AGENT_UNAVAILABLE 이면 AI 처리 전용 안내를 보여준다", async () => {
    server.use(
      http.get(FEED_ENDPOINT, () => fail("AGENT_UNAVAILABLE", "agent pool exhausted", 503)),
    );

    expect(await renderFeedError()).toBeInTheDocument();
    expect(screen.getByText(ERROR_MESSAGES.AGENT_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(ERROR_MESSAGES.FORBIDDEN)).not.toBeInTheDocument();
    expect(screen.queryByText(/agent pool exhausted/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  test("일반 500 이면 화면의 기존 일반 안내를 그대로 보여준다", async () => {
    server.use(http.get(FEED_ENDPOINT, () => fail("INTERNAL_ERROR", "npe at FeedService", 500)));

    expect(await renderFeedError()).toBeInTheDocument();
    expect(
      screen.getByText("일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/npe at FeedService/)).not.toBeInTheDocument();
  });
});
