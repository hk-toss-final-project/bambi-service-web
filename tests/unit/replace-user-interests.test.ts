import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `replaceUserInterests` — 선택 결과를 서버 상태로 수렴시키는 경로의 불변식.
 *
 * 회귀를 막으려는 실제 사고(2026-08-13): 온보딩에서 관심사를 직접 추가했다가 선택을 해제하면,
 * 그 항목이 서버에는 남는데 삭제되지 않아 `/api/onboarding/complete` 가 요구하는
 * "현재 관심사 전체 = 보낸 ID 목록" 조건이 깨졌다. 400 이 나면 호출부의 상태 갱신이 건너뛰어져
 * 화면이 들고 있던 목록이 낡은 채로 남고, 다시 눌러도 같은 400 이 반복되는 고착이 됐다.
 *
 * 그래서 **삭제 기준이 호출부의 `current` 가 아니라 서버 실상태여야 한다**는 것이 핵심 불변식이다.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const request = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGet(...args),
    apiPost: (...args: unknown[]) => apiPost(...args),
    apiPut: (...args: unknown[]) => apiPut(...args),
    request: (...args: unknown[]) => request(...args),
  };
});

const { replaceUserInterests } = await import("@/lib/repositories/interests");

/** GET /api/interests 응답 1건. 저장 경로가 USER 만 다루므로 source 는 고정한다. */
function interest(id: number, name: string) {
  return { id, name, source: "USER", taxonomyVersion: null, topicId: null };
}

/** DELETE 로 나간 관심사 id 목록 — request 목의 호출 인자에서 뽑는다. */
function deletedIds(): number[] {
  return request.mock.calls
    .filter(([, options]) => (options as { method?: string })?.method === "DELETE")
    .map(([path]) => Number(String(path).split("/").pop()));
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPut.mockReset();
  request.mockReset();
  apiPost.mockResolvedValue(interest(99, "새 관심사"));
  request.mockResolvedValue(null);
});

describe("replaceUserInterests", () => {
  it("호출부가 모르는 서버 잔여물도 선택 해제됐으면 삭제한다", async () => {
    // 화면은 빈 목록을 들고 있지만(직전 실패로 갱신되지 않은 상태), 서버에는 asdf 가 남아 있다.
    const server = [interest(1, "여행"), interest(2, "asdf")];
    apiGet.mockResolvedValue(server);

    await replaceUserInterests([{ name: "여행" }], []);

    expect(deletedIds()).toEqual([2]); // current 에 없던 asdf 가 지워져야 고착이 풀린다
  });

  it("선택된 항목은 서버에 남아 있어도 삭제하지 않는다", async () => {
    apiGet.mockResolvedValue([interest(1, "여행"), interest(2, "음악")]);

    await replaceUserInterests([{ name: "여행" }, { name: "음악" }], []);

    expect(deletedIds()).toEqual([]);
  });

  it("이미 등록돼 409 가 와도 실패로 보지 않는다", async () => {
    const { ApiError } = await import("@/lib/api-client");
    const { ERROR_CODES } = await import("@/constants/errors");
    apiGet.mockResolvedValue([interest(1, "여행")]);
    apiPost.mockRejectedValue(new ApiError(ERROR_CODES.DUPLICATE_RESOURCE, "이미 등록", 409));

    await expect(replaceUserInterests([{ name: "여행" }], [])).resolves.toBeDefined();
  });

  it("삭제 대상이 이미 사라져 404 가 와도 실패로 보지 않는다", async () => {
    const { ApiError } = await import("@/lib/api-client");
    const { ERROR_CODES } = await import("@/constants/errors");
    apiGet.mockResolvedValue([interest(2, "asdf")]);
    request.mockRejectedValue(new ApiError(ERROR_CODES.NOT_FOUND, "없음", 404));

    await expect(replaceUserInterests([{ name: "여행" }], [])).resolves.toBeDefined();
  });
});
