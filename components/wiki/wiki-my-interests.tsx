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
  onRemoved,
}: {
  state: MyInterestsState & { refetch: () => void };
  wikiTags: WikiTag[] | null;
  /** 뺀 관심사 이름을 알린다 — 화면이 그 이름을 왼쪽 목록에 남겨 되돌릴 수 있게 한다. */
  onRemoved: (name: string) => void;
}) {
  return (
    // 발견 후보 패널과 짝을 이루는 박스(2026-08-11 우석 — 2열 배치). 같은 껍데기·같은 제목 크기라
    // 왼쪽에서 추가하면 오른쪽에 나타나는 이동이 한눈에 읽힌다.
    <section
      aria-label="내 관심사"
      className="rounded-[14px] border border-border bg-card px-[18px] py-4"
    >
      <h2 className="flex items-baseline gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
        내 관심사
        {state.status === "success" && (
          <span className="text-[12px] font-semibold text-muted-foreground">{state.data.length}개</span>
        )}
      </h2>
      {/*
        안내는 섹션에 한 번만 둔다(2026-08-11 우석 — 화면 정리). 이전에는 카드마다
        "직접 추가한 관심사예요 — 관련 자료를 저장하면 AI 이해가 깊어져요"가 똑같이 반복돼
        10개면 같은 문장이 10번 나왔다. 행에는 그 관심사에만 해당하는 근거(hover)만 남긴다.
      */}
      <p className="mt-1 mb-3 text-[12.5px] leading-[1.6] text-muted-foreground">
        브리핑 주제로 쓰는 관심사예요. 삭제하면 왼쪽 발견 목록으로 돌아가요.
      </p>

      {state.status === "loading" && <FeedSkeleton />}

      {state.status === "error" && (
        <StateView
          role="alert"
          className="min-h-[120px]"
          icon={<IconAlert />}
          title="내 관심사를 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          actions={[{ label: "다시 시도", onClick: state.refetch, variant: "primary" }]}
        />
      )}

      {state.status === "success" && state.data.length === 0 && (
        <StateView
          className="min-h-[120px]"
          icon={<IconEmptyDoc />}
          title="아직 관심사가 없어요"
          description="왼쪽 발견 목록에서 추가하거나, 관심 자료를 저장해 AI가 찾게 해보세요."
        />
      )}

      {state.status === "success" && state.data.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {state.data.map((interest) => (
            <InterestCard
              key={interest.id}
              interest={interest}
              matched={findMatchedTag(interest, wikiTags)}
              onRemoved={onRemoved}
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
  onRemoved,
}: {
  interest: InterestDto;
  matched: WikiTag | null;
  onRemoved: (name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function remove() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    deleteInterest(interest.id)
      .then(() => onRemoved(interest.name))
      .catch((err) => {
        // 이미 삭제된 경우 목표 상태 달성 — 목록 재조회로 정합시킨다.
        if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
          onRemoved(interest.name);
          return;
        }
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  /**
   * 근거 문구는 카드에 펼치지 않고 hover(title)로만 준다 (2026-08-11 우석 — 화면 정리).
   * agent 가 주는 근거가 대부분 같은 상용구("저장한 자료에서 반복해 나타난 주제예요")라,
   * 카드마다 "AI는 이렇게 이해했어요 + 같은 한 줄"이 반복되며 10건이면 화면 서너 개 분량이 됐다.
   * 관심사별로 다른 정보는 이름·일치 여부·신뢰도뿐이므로 그 셋만 한 줄에 남긴다.
   */
  const reasonTitle = matched && matched.reasonMessages.length > 0
    ? matched.reasonMessages.join(" · ")
    : undefined;

  return (
    // 한 줄 행 — 패널 배경(bg-card) 위에 놓이므로 bg-background 로 한 톤 낮춘다(발견 칩과 동일 규칙).
    <article
      className="rounded-[10px] border border-border bg-background px-3 py-2"
      title={reasonTitle}
    >
      {/*
        배지·신뢰도 퍼센트는 노출하지 않는다 (2026-08-11 우석).
        confidence 는 agent 산식이 `0.4 + 출처수*0.12 + min(연결,10)*0.03` 이라 바닥이 0.4 로
        고정이고, 온보딩으로 들어온 관심사는 전부 출처 1·연결 0 이라 **모두 52% 로 같게 나왔다**
        — 정밀해 보이지만 변별이 0 인 수치라 「근거 없는 수치 노출 금지」 규칙에 걸린다.
        "AI 일치" 라벨도 실제 의미는 "일치도"가 아니라 agent 의 태그 확신도라 오해를 만들었다.
        값이 실제로 갈리기 시작하면 그때 근거와 함께 되살린다.
      */}
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[13.5px] font-bold text-foreground">
          {interest.name}
        </span>
        <span className="flex-1" />
        {failed && (
          <span role="alert" className="shrink-0 text-[11.5px] text-signal-ink">
            삭제 실패
          </span>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-busy={busy}
          aria-label={`${interest.name} 관심사 삭제`}
          className="focus-ring shrink-0 rounded-[7px] border border-border bg-background px-2 py-0.5 text-[11.5px] font-semibold text-ink-mid hover:text-signal-ink disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </article>
  );
}
