"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ERROR_CODES, resolveErrorMessage } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { generateReport } from "@/lib/repositories/generation";
import type { MyInterestsState } from "@/hooks/use-my-interests";
import type { InterestDto } from "@/types/interest";

/**
 * 온디맨드 보고서 생성 mutation 훅 — 관심사 1개 선택 + POST /api/reports/generate.
 *
 * **관심사 목록은 이 훅이 조회하지 않는다.** 데스크톱 rail 과 모바일 패널이 동시에 DOM 에 있어도
 * GET /api/interests 가 한 번만 나가야 하므로, 상위(HomeView)가 `useMyInterests()` 를 1회 소유해
 * 그 상태를 이 훅과 두 패널에 함께 내려준다.
 *
 * 상태 규약:
 * - 선택은 **id 만** 보관하고, 실제 선택 항목은 렌더 시점에 목록에서 찾는다(`selected`). 목록이
 *   refetch 로 갱신돼 그 관심사가 사라지면 선택도 자연히 풀린다 — 동기화 effect 가 필요 없고,
 *   사라진 관심사로 요청이 나갈 수도 없다.
 * - 성공은 **접수(202)** 확인일 뿐이다. `accepted` 를 "생성 완료"로 읽지 않도록 호출부 문구를 맞춘다.
 * - 실패 시 선택을 유지해 같은 버튼으로 바로 재시도할 수 있게 한다. 단 INTEREST_NOT_FOUND 는
 *   그 선택 자체가 무효라 선택을 비우고 목록을 다시 읽는다.
 * - 서버 error.message 원문은 쓰지 않는다(§4 — 문구는 코드 기준 매핑).
 *
 * 중복 클릭 방지는 use-card-like.ts 와 같은 **ref 동기 락**이다: 같은 tick 연타는 리렌더 전이라
 * submitting state 가 아직 false 로 보여 통과하지만, ref 는 첫 클릭이 즉시 잠근다.
 */
export type OnDemandGenerationState = {
  /** 선택된 관심사. 목록에 없으면 null(사라진 항목이 남아 있지 않는다). */
  selected: InterestDto | null;
  select: (interest: InterestDto) => void;
  submit: () => void;
  submitting: boolean;
  /** 서버가 생성 요청을 접수함(202). **생성 완료가 아니다.** */
  accepted: boolean;
  /** 사용자 노출 문구. null 이면 오류 없음. */
  errorMessage: string | null;
  /** 제출 가능 여부 — 선택됨 + 진행 중 아님 + topic 이 공백이 아님. */
  canSubmit: boolean;
};

export function useOnDemandGeneration(
  interests: MyInterestsState & { refetch: () => void },
): OnDemandGenerationState {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inFlight = useRef(false); // 동기 가드 — 같은 tick 연타를 첫 클릭이 즉시 막는다
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort(); // 언마운트 후 setState 방지 + 진행 중 요청 정리
    };
  }, []);

  // 선택 항목은 목록에서 파생한다 — 목록이 바뀌면 유효하지 않은 선택은 저절로 사라진다.
  const items = interests.status === "success" ? interests.data : null;
  const selected = items?.find((interest) => interest.id === selectedId) ?? null;

  const select = useCallback((interest: InterestDto) => {
    setSelectedId(interest.id);
    // 새 선택은 직전 결과의 문맥을 지운다(이전 성공 안내·오류가 새 선택에 붙어 보이지 않게).
    setAccepted(false);
    setErrorMessage(null);
  }, []);

  const topic = selected?.name.trim() ?? "";
  const canSubmit = topic !== "" && !submitting;

  const submit = useCallback(() => {
    if (inFlight.current) return; // 진행 중 재진입 차단 — 요청은 항상 1건
    // 공백 topic 은 요청 자체를 만들지 않는다(repository 도 같은 값을 한 번 더 막는다).
    const current = items?.find((interest) => interest.id === selectedId) ?? null;
    const nextTopic = current?.name.trim() ?? "";
    if (nextTopic === "") return;

    inFlight.current = true;
    setSubmitting(true);
    setAccepted(false);
    setErrorMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    generateReport({ topic: nextTopic }, controller.signal)
      .then(() => {
        if (!mounted.current) return;
        setAccepted(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || !mounted.current) return; // abort 는 오류로 취급하지 않는다
        const code = err instanceof ApiError ? err.code : null;
        if (code === ERROR_CODES.INTEREST_NOT_FOUND) {
          // 그 사이 관심사가 사라졌다 → 선택을 비우고 서버 확정 목록을 다시 읽는다.
          setSelectedId(null);
          interests.refetch();
        }
        setErrorMessage(resolveErrorMessage(code));
      })
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) setSubmitting(false);
      });
  }, [items, selectedId, interests]);

  return { selected, select, submit, submitting, accepted, errorMessage, canSubmit };
}
