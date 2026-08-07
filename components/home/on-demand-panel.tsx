"use client";

import Link from "next/link";

import type { MyInterestsState } from "@/hooks/use-my-interests";
import type { OnDemandGenerationState } from "@/hooks/use-on-demand-generation";

/**
 * 온디맨드 보고서 생성 패널 — 내 관심사(GET /api/interests, source=USER) 1개를 골라
 * POST /api/reports/generate 로 생성을 **요청**한다.
 *
 * 데스크톱(홈 우측 rail)과 모바일([내 보고서] 탭 상단)이 **같은 컴포넌트**를 쓴다. 두 인스턴스가
 * 동시에 DOM 에 있어도 관심사 API 는 한 번만 나간다 — 조회·mutation 상태를 상위(HomeView)가
 * 1회 소유해 props 로 내려주고, 이 컴포넌트는 렌더만 한다.
 *
 * 두 인스턴스의 radio 가 서로를 덮어쓰지 않도록 `instanceId` 로 `name`·`id` 를 분리한다.
 * 선택 상태 자체는 공유 상태라 어느 쪽에서 고르든 양쪽이 같이 반영된다.
 *
 * **Wiki 태그는 이 화면에서 다루지 않는다.** 선택지는 이미 Service 에 저장된 관심사뿐이고,
 * Wiki 추천으로 생성하려면 사용자가 `/wiki` 에서 먼저 관심사로 추가해야 한다.
 *
 * 성공은 "요청 접수"까지만 알린다 — 완료로 표현하지 않고, 가짜 진행 카드도 만들지 않는다.
 */
export function OnDemandPanel({
  instanceId,
  interests,
  generation,
  className,
}: {
  instanceId: string;
  interests: MyInterestsState & { refetch: () => void };
  generation: OnDemandGenerationState;
  className?: string;
}) {
  return (
    <section
      aria-label="온디맨드 보고서 만들기"
      className={`rounded-[14px] border border-border bg-card px-4 py-[15px] ${className ?? ""}`}
    >
      <h2 className="text-[13px] font-bold text-foreground">온디맨드 보고서 만들기</h2>
      <p className="mt-1 text-[12px] leading-[1.6] text-muted-foreground">
        내 관심사 하나를 골라 바로 보고서를 요청하세요.
      </p>

      <div className="mt-3">
        {interests.status === "loading" && <InterestsSkeleton />}
        {interests.status === "error" && <InterestsError onRetry={interests.refetch} />}
        {interests.status === "success" &&
          (interests.data.length === 0 ? (
            <InterestsEmpty />
          ) : (
            <InterestPicker
              instanceId={instanceId}
              interests={interests.data}
              generation={generation}
            />
          ))}
      </div>
    </section>
  );
}

/** 관심사 목록 + 제출. 실제 값이 1건 이상일 때만 렌더된다. */
function InterestPicker({
  instanceId,
  interests,
  generation,
}: {
  instanceId: string;
  interests: NonNullable<Extract<MyInterestsState, { status: "success" }>["data"]>;
  generation: OnDemandGenerationState;
}) {
  const groupName = `on-demand-topic-${instanceId}`;

  return (
    <>
      {/* 단일 선택 radio. fieldset/legend 로 그룹 이름을 스크린리더에 전달한다. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">보고서를 만들 관심사 선택</legend>
        <ul className="flex flex-col gap-1">
          {interests.map((interest) => {
            const inputId = `${groupName}-${interest.id}`;
            const checked = generation.selected?.id === interest.id;
            return (
              <li key={interest.id} className="min-w-0">
                <label
                  htmlFor={inputId}
                  className={`focus-within:ring-wash flex cursor-pointer items-start gap-2 rounded-[10px] border px-2.5 py-2 focus-within:ring-[3px] ${
                    checked
                      ? "border-primary bg-wash"
                      : "border-border bg-transparent hover:bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    id={inputId}
                    name={groupName}
                    value={String(interest.id)}
                    checked={checked}
                    onChange={() => generation.select(interest)}
                    disabled={generation.submitting}
                    className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-[var(--primary)] disabled:opacity-50"
                  />
                  {/* 긴 관심사명도 300px 폭에서 넘치지 않게 줄바꿈한다(가로 스크롤 금지). */}
                  <span
                    className={`min-w-0 text-[12.5px] leading-[1.45] break-words ${
                      checked ? "font-semibold text-signal-ink" : "text-ink-mid"
                    }`}
                  >
                    {interest.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <button
        type="button"
        onClick={generation.submit}
        disabled={!generation.canSubmit}
        aria-busy={generation.submitting}
        className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded-lg border border-primary bg-primary px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96] disabled:opacity-50"
      >
        {generation.submitting ? "요청 중…" : "선택한 관심사로 만들기"}
      </button>

      {/*
        접수 성공 — "완료"가 아니라 "요청함"이다. 여기서 진행 카드·완료 시각·이동 링크를 만들지
        않는다(Pending 조회가 별도 범위라 진행 상태를 알 방법이 없다).
      */}
      {generation.accepted && (
        <p role="status" className="mt-2 text-[12px] leading-[1.6] text-signal-ink">
          보고서 생성을 요청했어요.
        </p>
      )}

      {/* 오류 — 공통 매핑 문구만 쓴다(서버 원문 미노출). 선택은 유지돼 바로 재시도할 수 있다. */}
      {generation.errorMessage !== null && (
        <p role="alert" className="mt-2 text-[12px] leading-[1.6] text-ink-mid">
          {generation.errorMessage}
        </p>
      )}
    </>
  );
}

/**
 * 관심사 0건 — 이 화면에서 관심사를 만들지 않는다(생성 버튼이 관심사를 몰래 추가하면
 * 사용자가 등록한 적 없는 관심사가 생긴다). 실제 관리 화면으로 보낸다.
 */
function InterestsEmpty() {
  return (
    <>
      <p className="text-[12.5px] leading-[1.6] text-muted-foreground">
        먼저 관심사를 추가해 주세요.
      </p>
      {/* /wiki = 좌측 메뉴의 "관심사 · LLM Wiki" 실제 라우트(lib/mock/feed.ts MOCK_MENU). */}
      <Link
        href="/wiki"
        className="focus-ring mt-2.5 inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-background"
      >
        관심사 관리하기 →
      </Link>
    </>
  );
}

/** 조회 실패 — rail 범위에서만 알리고 재시도를 제공한다(이전 값·mock 으로 대체하지 않는다). */
function InterestsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <p className="text-[12.5px] leading-[1.6] text-ink-mid">
        관심사를 불러오지 못했어요. 일시적인 문제일 수 있어요.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="focus-ring mt-2.5 inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-background"
      >
        다시 시도
      </button>
    </div>
  );
}

/** 로딩 — 중립 placeholder. 실제 관심사명을 먼저 노출하지 않는다. */
function InterestsSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div aria-hidden="true" className="animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-[7px]">
          <div className={`h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--skel1)]`} />
          <div className={`h-3 w-full ${bar}`} />
        </div>
      ))}
      <div className={`mt-3 h-[31px] w-full ${bar}`} />
    </div>
  );
}
