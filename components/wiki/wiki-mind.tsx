"use client";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import type { WikiTag } from "@/types/wiki";

/** 목업 .mind 기준 표시 상한 — 상위 4개(강도순). 나머지는 발견 후보·자료 필터에서 노출된다. */
const MIND_ROW_LIMIT = 4;

/**
 * [AI가 이해한 지금의 나] — 목업 wiki.html .mind 1:1 (2026-08-05 목업 정렬).
 * 데이터는 자동추출 관심 태그(GET /api/wiki/tags)의 score(0~1, 상대 관심 강도).
 * - 막대 폭 = round(score×100)%, 최소 8%(0 에 가까워도 막대가 사라져 보이지 않게 — rail 집계와 동일 규칙).
 * - 강도 워딩(.mw)은 목업 문구 그대로: 1위 "가장 큰 관심" / score≥0.5 "꾸준함" / 그 외 "가끔".
 *   ("잠시 쉬는 중"은 활성/중지 백엔드가 없어 만들지 않는다.)
 * - 행 클릭 = 하단 [내가 저장한 자료] 필터 토글(정보구조: 관심사 클릭 → 근거 자료).
 */
export function WikiMind({
  state,
  selectedId,
  onSelect,
}: {
  state: WikiInterestsState & { refetch: () => void };
  selectedId: string | null;
  onSelect: (tagId: string) => void;
}) {
  return (
    <section aria-label="AI가 이해한 지금의 나" className="mb-8">
      <div className="rounded-[14px] border border-border bg-card px-[18px] py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          AI가 이해한 지금의 나
        </h2>
        <p className="mt-0.5 mb-3.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          저장한 자료 기준 상대 강도예요 — 직접 추가·삭제한 관심사는 AI 추정보다 우선해요.
        </p>

        {state.status === "loading" && <FeedSkeleton />}

        {state.status === "error" && (
          <StateView
            role="alert"
            className="min-h-[160px]"
            icon={<IconAlert />}
            title="관심사를 불러오지 못했어요"
            description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
            actions={[{ label: "다시 시도", onClick: state.refetch, variant: "primary" }]}
          />
        )}

        {state.status === "empty" && (
          <StateView
            className="min-h-[160px]"
            icon={<IconEmptyDoc />}
            title="아직 파악한 관심사가 없어요"
            description="관심 자료를 저장하면 AI가 관심사를 파악해 여기에 정리해요."
          />
        )}

        {state.status === "success" && (
          <ul className="flex flex-col gap-2">
            {state.data.slice(0, MIND_ROW_LIMIT).map((tag, index) => (
              <MindRow
                key={tag.tagId}
                tag={tag}
                word={intensityWord(tag, index)}
                selected={tag.tagId === selectedId}
                onSelect={() => onSelect(tag.tagId)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** 강도 워딩 — 목업 .mw 문구. 절대 수치가 아니라는 오해를 막기 위해 %는 표기하지 않는다. */
function intensityWord(tag: WikiTag, index: number): string {
  if (index === 0) return "가장 큰 관심";
  return tag.score >= 0.5 ? "꾸준함" : "가끔";
}

function MindRow({
  tag,
  word,
  selected,
  onSelect,
}: {
  tag: WikiTag;
  word: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const width = Math.max(8, Math.round(tag.score * 100));
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`focus-ring flex w-full items-center gap-3 rounded-[8px] px-1.5 py-1 text-left ${
          selected ? "bg-background" : "hover:bg-background"
        }`}
      >
        <span
          className={`w-32 shrink-0 truncate text-[13px] font-semibold ${
            selected ? "text-signal-ink" : "text-foreground"
          }`}
        >
          {tag.tag}
        </span>
        <span aria-hidden="true" className="h-2 min-w-0 flex-1 rounded-full bg-background">
          <span
            className="block h-full rounded-full bg-primary/70"
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="w-24 shrink-0 text-right text-[12px] text-muted-foreground">{word}</span>
      </button>
    </li>
  );
}
