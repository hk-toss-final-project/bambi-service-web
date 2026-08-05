"use client";

import { useState } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { ERROR_CODES } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { deleteInterest } from "@/lib/repositories/interests";
import type { MyInterestsState } from "@/hooks/use-my-interests";
import type { InterestDto } from "@/types/interest";
import type { WikiTag } from "@/types/wiki";

/**
 * [내 관심사] — 목업 wiki.html .wcard 목록 기준 (2026-08-05 목업 정렬).
 * 원천 = GET /api/interests (source=USER, 온보딩·발견 후보 추가·직접 추가가 모두 이리로 모인다).
 * - 출처 배지: 기본 "직접 설정". 같은 이름의 자동추출 태그가 있으면 "◈ LLM 추론 일치" + 신뢰도 N% 병기
 *   (우리 데이터는 USER 관심사와 LLM 추론이 분리돼 있어, 목업의 단일 목록을 "이름 일치 병합 표시"로 재현한다).
 * - "AI는 이렇게 이해했어요" 근거 = 일치 태그의 evidence 문구(있을 때만). USER 뿐이면 목업 문구
 *   "직접 추가한 관심사예요" 한 줄만 둔다(없는 근거를 만들지 않는다).
 * - 삭제 = DELETE /api/interests/{id} (soft delete). 404 는 이미 없는 것 → 성공 취급(멱등).
 * - 목업의 "고정됨"·"잠시 쉬는 중"·수정하기 모달(rename)은 이번 범위 밖 — 고정/중지 백엔드가 없고
 *   rename 은 후속. 동작하지 않는 컨트롤을 만들지 않는다.
 */
export function WikiMyInterests({
  state,
  wikiTags,
  onChanged,
}: {
  state: MyInterestsState & { refetch: () => void };
  wikiTags: WikiTag[] | null;
  onChanged: () => void;
}) {
  return (
    <section aria-label="내 관심사" className="mb-8">
      <h2 className="mb-2.5 flex items-baseline gap-2 text-[17px] font-bold tracking-[-0.01em] text-foreground">
        내 관심사
        {state.status === "success" && (
          <span className="text-[12px] font-semibold text-muted-foreground">{state.data.length}개</span>
        )}
      </h2>

      {state.status === "loading" && <FeedSkeleton />}

      {state.status === "error" && (
        <StateView
          role="alert"
          className="min-h-[160px]"
          icon={<IconAlert />}
          title="내 관심사를 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          actions={[{ label: "다시 시도", onClick: state.refetch, variant: "primary" }]}
        />
      )}

      {state.status === "success" && state.data.length === 0 && (
        <StateView
          className="min-h-[160px]"
          icon={<IconEmptyDoc />}
          title="아직 관심사가 없어요"
          description="위 발견 목록에서 추가하거나, 관심 자료를 저장해 AI가 찾게 해보세요."
        />
      )}

      {state.status === "success" && state.data.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {state.data.map((interest) => (
            <InterestCard
              key={interest.id}
              interest={interest}
              matched={findMatchedTag(interest, wikiTags)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** 이름(trim·소문자) 일치로 자동추출 태그를 찾는다 — 표시 병합용, 데이터는 섞지 않는다. */
function findMatchedTag(interest: InterestDto, wikiTags: WikiTag[] | null): WikiTag | null {
  if (!wikiTags) return null;
  const name = interest.name.trim().toLowerCase();
  return wikiTags.find((tag) => tag.tag.trim().toLowerCase() === name) ?? null;
}

function InterestCard({
  interest,
  matched,
  onChanged,
}: {
  interest: InterestDto;
  matched: WikiTag | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function remove() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    deleteInterest(interest.id)
      .then(() => onChanged())
      .catch((err) => {
        // 이미 삭제된 경우 목표 상태 달성 — 목록 재조회로 정합시킨다.
        if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
          onChanged();
          return;
        }
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  const reasons = matched && matched.reasonMessages.length > 0 ? matched.reasonMessages.slice(0, 3) : null;

  return (
    <article className="rounded-[14px] border border-border bg-card px-[18px] py-4">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 truncate text-[14px] font-bold text-foreground">{interest.name}</span>
        {matched ? (
          <>
            <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] font-semibold text-signal-ink">
              ◈ LLM 추론 일치
            </span>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">
              신뢰도 {Math.round(matched.confidence * 100)}%
            </span>
          </>
        ) : (
          <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] font-semibold text-ink-mid">
            직접 설정
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-busy={busy}
          className="focus-ring shrink-0 rounded-[8px] border border-border bg-background px-2.5 py-1 text-[12px] font-semibold text-ink-mid hover:text-signal-ink disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      <div className="mt-2.5 text-[11.5px] font-bold tracking-wide text-muted-foreground uppercase">
        AI는 이렇게 이해했어요
      </div>
      {reasons ? (
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-[12.5px] leading-[1.6] text-ink-mid">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12.5px] leading-[1.6] text-ink-mid">
          직접 추가한 관심사예요{matched ? "" : " — 관련 자료를 저장하면 AI 이해가 깊어져요"}.
        </p>
      )}

      {failed && (
        <div role="alert" className="mt-2 text-[12px] text-signal-ink">
          삭제하지 못했어요. 다시 시도해 주세요.
        </div>
      )}
    </article>
  );
}
