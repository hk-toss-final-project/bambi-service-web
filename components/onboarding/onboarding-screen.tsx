"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { InterestAddModal } from "@/components/onboarding/interest-add-modal";
import { ChipCheckIcon, InterestPicker } from "@/components/onboarding/interest-picker";
import { PageState } from "@/components/ui/page-state";
import { IconAlert } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { ERROR_CODES, type ErrorCode } from "@/constants/errors";
import { INTEREST_SELECTION_MAX } from "@/constants/interests";
import { useOnboardingInterests } from "@/hooks/use-onboarding-interests";
import { ApiError } from "@/lib/api-client";
import { replaceUserInterests } from "@/lib/repositories/interests";
import { completeOnboarding } from "@/lib/repositories/onboarding";
import type { InterestDto, InterestTaxonomyDto } from "@/types/interest";

/**
 * 관심사 온보딩 — /onboarding. 신규 가입 자동 로그인 성공 직후 진입한다(signup-form).
 * 시각 구현은 목업 docs/design-handoff/product/onboarding.html(.ob 풀페이지 규칙 포함) 1:1 기준.
 *
 * 핵심 정책:
 * - 관심사 **최소 1개 필수** — 건너뛰기 없음. 0개면 제출 CTA 비활성.
 * - 관심사 **최대 {@link INTEREST_SELECTION_MAX}개** — agent 계약값이라 넘기면 저장 자체가 실패한다
 *   (context 동기화 422 → 503). 화면이 먼저 막지 않으면 사용자는 이유를 모른 채 재시도만 하게 된다.
 * - 여기서 고른 관심사는 사용자가 직접 설정한 값(source=USER, 서버가 강제).
 *   agent 자동 추론 태그(INFERRED · /api/wiki/tags)는 조회·저장 어느 쪽에도 섞지 않는다.
 * - 저장한 관심사의 선택 순서를 Service에 확정하면 최대 3개의 첫 리포트가 비동기 등록된다.
 * - 관심사 저장과 온보딩 완료 처리까지 성공한 뒤에만 완료 화면으로 넘어간다.
 *
 * 인증 상태 4분기(설정·홈과 동일 패턴): loading→스켈레톤 / error→복원오류 / guest→접근제한 / authenticated→본문.
 * guest 직접 진입 시 관심사 API 는 호출하지 않는다(훅이 authenticated 에서만 요청).
 */
export function OnboardingScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <OnboardingSkeleton />;
  if (status === "error") return <OnboardingAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <OnboardingAccessRestricted />;
  return <OnboardingView />;
}

/** authenticated — 기존 USER 관심사 조회(재진입 시 미리 선택, §6) 후 선택 화면으로. */
function OnboardingView() {
  const interests = useOnboardingInterests();

  if (interests.status === "loading") return <OnboardingSkeleton />;
  // 조회 실패는 "선택 0개"로 위장하지 않는다 — 별도 오류 상태 + 재시도.
  if (interests.status === "error")
    return <OnboardingLoadError onRetry={interests.refetch} errorCode={interests.errorCode} />;
  return <OnboardingFlow initial={interests.data.interests} taxonomy={interests.data.taxonomy} />;
}

/**
 * 저장(POST·DELETE /api/interests) 문맥의 오류 문구 — 도메인 override(AddMaterialModal 패턴).
 * 전역 매핑의 DUPLICATE_RESOURCE 문구는 회원가입용이라 쓰지 않는다. 중복(409)·이미 삭제(404)는
 * repository 가 멱등 성공으로 흡수하므로 여기 도달하는 코드는 검증·서버·네트워크 오류다.
 */
function resolveInterestSaveError(code: string): string {
  if (code === ERROR_CODES.VALIDATION_ERROR) return "입력한 내용을 다시 확인해 주세요.";
  return "관심사를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

type OnboardingStep = "pick" | "done";

function OnboardingFlow({
  initial,
  taxonomy,
}: {
  initial: InterestDto[];
  taxonomy: InterestTaxonomyDto;
}) {
  const catalogTopics = new Map(
    taxonomy.categories.flatMap((category) =>
      category.topics.map((topic) => [topic.name, topic] as const),
    ),
  );
  const catalogTopicNames = new Set(catalogTopics.keys());
  const [step, setStep] = useState<OnboardingStep>("pick");
  /** 서버 스냅샷(USER 관심사) — 저장 diff 의 기준. 저장 성공 시 확정본으로 갱신. */
  const [current, setCurrent] = useState<InterestDto[]>(initial);
  /** 선택된 topic(name). 재진입 시 기존 USER 관심사를 미리 선택한다(§6). */
  const [selected, setSelected] = useState<string[]>(() => initial.map((i) => i.name));
  /** 카탈로그 밖 topic(직접 추가 + 서버에 있던 것) — "직접 추가" 그룹에 표시. */
  const [customTopics, setCustomTopics] = useState<string[]>(() =>
    initial.map((i) => i.name).filter((name) => !catalogTopicNames.has(name)),
  );
  /** 저장 성공 후 서버 확정본 — 완료 화면 요약은 이 값만 신뢰한다. */
  const [saved, setSaved] = useState<InterestDto[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 같은 프레임 안의 연타는 state(submitting) 반영 전에 통과할 수 있어 ref 로 동기 차단한다.
  const submittingRef = useRef(false);

  const selectedSet = new Set(selected);
  /*
    상한을 넘긴 상태로는 제출을 막는다 — 서버가 어차피 거절하므로(agent 422 → 503) 눌러봐야
    "잠시 후 다시 시도해 주세요" 만 반복된다. 재진입해서 이미 13개 이상 갖고 있는 사용자도
    여기 걸리므로, 아래 안내가 "몇 개를 빼야 하는지"까지 알려준다.
  */
  const overLimit = selected.length > INTEREST_SELECTION_MAX;
  const atLimit = selected.length >= INTEREST_SELECTION_MAX;
  const canSubmit = selected.length >= 1 && !overLimit && !submitting;

  function toggle(name: string) {
    setSaveError(null);
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      // 해제는 언제나 되고 추가만 막는다 — 상한을 넘긴 상태에서도 줄일 수 있어야 한다.
      if (prev.length >= INTEREST_SELECTION_MAX) return prev;
      return [...prev, name];
    });
  }

  /** 직접 추가 — 카탈로그에 있으면 선택만, 없으면 custom 그룹에 추가 후 선택. API 호출 없음(저장은 제출에서). */
  function handleAdd(name: string) {
    setSaveError(null);
    if (selected.length >= INTEREST_SELECTION_MAX && !selected.includes(name)) return;
    if (!catalogTopicNames.has(name)) {
      setCustomTopics((prev) => (prev.includes(name) ? prev : [...prev, name]));
    }
    setSelected((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected.length === 0 || submittingRef.current) return; // 0개·제출 중 → 무시(중복 요청 차단)

    submittingRef.current = true;
    setSaveError(null);
    setSubmitting(true);
    try {
      const selections = selected.map((name) => {
        const topic = catalogTopics.get(name);
        return topic
          ? { name, taxonomyVersion: taxonomy.version, topicId: topic.id }
          : { name };
      });
      // 먼저 관심사 CRUD를 목표 상태로 수렴시키고 서버의 canonical ID를 다시 읽는다.
      const canonical = await replaceUserInterests(selections, current);
      const canonicalByName = new Map(canonical.map((interest) => [interest.name, interest]));
      const orderedInterestIds = selected.map((name) => canonicalByName.get(name)?.id);
      if (orderedInterestIds.some((id) => id === undefined)) {
        throw new ApiError(
          ERROR_CODES.INTERNAL_ERROR,
          "saved interests do not match onboarding selection",
          200,
        );
      }
      // Service가 이 순서로 Agent Context를 확정하고 선정 규칙에 따라 최대 3개를 생성한다.
      await completeOnboarding(orderedInterestIds as number[]);
      const canonicalNames = canonical.map((i) => i.name);
      setCurrent(canonical);
      setSaved(canonical);
      // 서버 확정본 기준으로 선택 상태를 재정렬(서버 strip 등 정규화 반영).
      setSelected(canonicalNames);
      setCustomTopics((prev) => {
        const merged = [...prev];
        for (const name of canonicalNames) {
          if (!catalogTopicNames.has(name) && !merged.includes(name)) merged.push(name);
        }
        return merged;
      });
      setStep("done"); // 실제 저장 성공 후에만 완료 화면
    } catch (err) {
      // 실패 시 선택 유지 — 문구는 §4 정책(코드 기준, 서버 원문 비노출).
      const code = err instanceof ApiError ? err.code : ERROR_CODES.INTERNAL_ERROR;
      setSaveError(resolveInterestSaveError(code));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-card">
        <OnboardingHeader stepLabel="완료" stepNo={2} />
        {/* .ob-body — 완료 카드는 별도 박스 없이 흰 배경 위 세로 중앙(.ob-done) */}
        <main className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-[30px]">
            <div className="flex w-full max-w-[560px] flex-col items-center gap-2.5 text-center">
              {/* .ob-orb */}
              <div className="mb-1.5 flex h-14 w-14 items-center justify-center">
                <Orb size={46} />
              </div>
              <h1 className="text-[25px] font-bold tracking-[-0.015em] text-balance text-foreground">
                관심사 설정이 완료됐어요
              </h1>
              <p className="text-[14px] leading-[1.7] text-pretty text-muted-foreground">
                선택한 관심사를 바탕으로 필요한 소식을 더 잘 골라드릴게요.
              </p>

              {/* .ob-recap — 서버 확정본. chip.on 축소형(7px 14px · 12.5px) */}
              <ul aria-label="저장된 관심사" className="mt-2.5 mb-1 flex flex-wrap justify-center gap-2">
                {saved.map((interest) => (
                  <li
                    key={interest.id}
                    className="inline-flex items-center gap-[7px] rounded-full border border-primary bg-wash px-3.5 py-[7px] text-[12.5px] font-semibold text-signal-ink"
                  >
                    <ChipCheckIcon />
                    {interest.name}
                  </li>
                ))}
              </ul>

              {/* .ob-cta — 가로 배치, 주 CTA 1개 */}
              <div className="mt-3.5 flex flex-wrap justify-center gap-2.5">
                <Link
                  href="/"
                  className="focus-ring inline-flex items-center justify-center rounded-[10px] border border-primary bg-primary px-[15px] py-[9px] text-[13.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
                >
                  내 보고서로 가기
                </Link>
              </div>
              {/* .ob-back2 — 밑줄 텍스트 링크형 */}
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="focus-ring mt-2 rounded-[6px] text-[13px] text-muted-foreground underline underline-offset-[3px] hover:text-ink-mid"
              >
                관심사 다시 고르기
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-card">
      <OnboardingHeader stepLabel="관심사 선택" stepNo={1} />
      <main className="flex flex-1 flex-col">
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
          {/* .ob-body — 42px 32px 30px, 콘텐츠 중앙 정렬 */}
          <div className="flex flex-1 flex-col items-center px-8 pt-[42px] pb-[30px]">
            {/* .ob-wrap — 720px 중앙 칼럼 */}
            <div className="w-[720px] max-w-full">
              {/* .ob-title / .ob-sub — 중앙 정렬 */}
              <h1 className="text-center text-[26px] font-bold tracking-[-0.015em] text-balance text-foreground">
                무엇을 챙겨드릴까요?
              </h1>
              <p className="mt-2.5 mb-[30px] text-center text-[14px] leading-[1.65] text-pretty text-muted-foreground">
                관심사를 하나 이상 고르면 필요한 소식을 더 정확하게 골라드려요.
              </p>

              <InterestPicker
                categories={taxonomy.categories}
                customTopics={customTopics}
                selected={selectedSet}
                disabled={submitting}
                atLimit={atLimit}
                onToggle={toggle}
                onOpenAdd={() => setAddOpen(true)}
              />
            </div>
          </div>

          {/* .ob-foot — viewport 전체 폭, 좌 카운트 / 우 CTA. sticky 라 본문을 가리지 않고 항상 도달 가능 */}
          <div className="sticky bottom-0 z-10 border-t border-border bg-card px-[max(32px,calc((100%_-_1376px)/2))] py-[15px]">
            {saveError && (
              <p
                role="alert"
                aria-live="assertive"
                className="mb-2.5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {saveError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
              {/* .ob-count — 선택 수 변화를 SR 에도 알린다(짧은 문구라 polite 로 충분) */}
              <span aria-live="polite" className="text-[13px] text-muted-foreground">
                선택 <b className="font-bold text-signal-ink">{selected.length}</b>개
              </span>
              {/*
                .ob-hint — 상한은 agent 계약값이라 넘기면 저장 자체가 안 된다(constants/interests.ts).
                평소엔 범위만 알려주고, 꽉 찼을 때만 왜 더 안 눌리는지 말해준다.
              */}
              <span
                aria-live="polite"
                className={`text-xs ${atLimit ? "font-semibold text-signal-ink" : "text-muted-foreground"}`}
              >
                {overLimit
                  ? `최대 ${INTEREST_SELECTION_MAX}개 — ${selected.length - INTEREST_SELECTION_MAX}개를 빼주세요`
                  : atLimit
                    ? `최대 ${INTEREST_SELECTION_MAX}개까지 골랐어요`
                    : `최소 1개 · 최대 ${INTEREST_SELECTION_MAX}개`}
              </span>
              <span className="flex-1" />
              {/* .btn.signal (+.dis 45% 흐림) */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="focus-ring inline-flex items-center justify-center rounded-[10px] border border-primary bg-primary px-[15px] py-[9px] text-[13.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96] disabled:opacity-45"
              >
                {submitting ? "저장 중…" : "계속하기"}
              </button>
            </div>
          </div>
        </form>
      </main>

      <InterestAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        selectedNames={selected}
        onAdd={handleAdd}
      />
    </div>
  );
}

/** .ob-head — 풀블리드 상단바(로고 좌 · 단계 우), 하단 보더. 온보딩 전용 흐름이라 HomeNav 를 쓰지 않는다. */
function OnboardingHeader({
  stepLabel = "관심사 선택",
  stepNo = 1,
}: {
  stepLabel?: string;
  stepNo?: 1 | 2;
}) {
  return (
    <header className="flex items-center gap-[9px] border-b border-border bg-card px-[max(32px,calc((100%_-_1376px)/2))] py-5">
      <Orb size={22} />
      <span className="text-[15px] font-normal text-foreground [font-family:Quicksand,sans-serif]">
        alphacatcher
      </span>
      {/* .ob-step — b 는 signal-ink */}
      <span className="ml-auto text-[12.5px] whitespace-nowrap text-muted-foreground">
        {stepLabel} · <b className="font-bold text-signal-ink">{stepNo}</b> / 2
      </span>
    </header>
  );
}

/** 인증 복구·관심사 조회 중 — 중립 스켈레톤(개인 정보·CTA 없음). 목업 골격(중앙 720px)과 동일 배치. */
function OnboardingSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="flex min-h-[100dvh] flex-col bg-card">
      <OnboardingHeader />
      <main className="flex flex-1 flex-col items-center px-8 pt-[42px] pb-[30px]" aria-hidden="true">
        <div className="w-[720px] max-w-full">
          <div className={`mx-auto h-8 w-64 ${bar}`} />
          <div className={`mx-auto mt-3 h-4 w-80 max-w-full ${bar}`} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mt-7 animate-pulse">
              <div className={`h-3.5 w-20 ${bar}`} />
              <div className="mt-2.5 flex flex-wrap gap-[9px]">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className={`h-[38px] w-28 rounded-full ${bar}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 관심사 조회 실패 — 선택 0개로 위장하지 않고 오류 + 재시도를 보여준다(저장 오류와 별개). */
function OnboardingLoadError({
  onRetry,
  errorCode,
}: {
  onRetry: () => void;
  errorCode?: ErrorCode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-card">
      <OnboardingHeader />
      <main className="flex flex-1 items-center justify-center px-8 py-10">
        <h1 className="sr-only">관심사 선택</h1>
        <StateView
          role="alert"
          icon={<IconAlert />}
          title="관심사를 불러오지 못했어요"
          description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
          errorCode={errorCode}
          actions={[
            { label: "다시 시도", onClick: onRetry, variant: "primary" },
            { label: "홈으로", href: "/", variant: "ghost" },
          ]}
          className="w-[420px] max-w-full"
        />
      </main>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공(설정과 동일 패턴). */
function OnboardingAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-card">
      <OnboardingHeader />
      <PageState
        role="alert"
        icon={<IconAlert />}
        title="인증 상태를 확인하지 못했어요"
        description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
        actions={[
          { label: "다시 시도", onClick: onRetry, variant: "primary" },
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}

/** guest 직접 진입 — 개인 설정 흐름이라 본문 대신 접근 제한 안내(§15). 관심사 API 는 호출되지 않는다. */
function OnboardingAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-card">
      <OnboardingHeader />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="관심사 설정은 로그인한 사용자만 할 수 있어요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
