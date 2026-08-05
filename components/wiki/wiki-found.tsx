"use client";

import { useState } from "react";

import { ERROR_CODES } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { createInterest } from "@/lib/repositories/interests";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import type { InterestDto } from "@/types/interest";
import type { WikiTag } from "@/types/wiki";

/**
 * 후보 표시 상한 — 강도순. 목업은 2건만 뒀지만 실사용에서 후보가 너무 적게 보여
 * "AI가 파악한 범위가 좁다"는 인상을 줬다(2026-08-05 우석 지적). 한 화면에서 훑고 고를 수 있는
 * 선에서 넉넉히 연다.
 */
const FOUND_LIMIT = 12;

/**
 * [AI가 최근 발견한 관심사] — 목업 wiki.html .found 기준 (2026-08-05 목업 정렬).
 * 후보 = 자동추출 태그(GET /api/wiki/tags) 중 [내 관심사](source=USER)에 아직 없는 것.
 * - "＋ 추가" = POST /api/interests {name} → 성공 시 내 관심사 목록 refetch(카드가 아래 섹션으로 이동).
 *   409(이미 등록)는 목표 상태 달성으로 간주해 성공 처리한다(온보딩 replace 규칙과 동일).
 * - 목업의 "무시" 버튼은 만들지 않는다 — 무시 상태를 저장할 백엔드가 없어 새로고침이면 되돌아오는
 *   가짜 동작이 된다(동작하지 않는 UI 금지). 후보가 0건이면 섹션 자체를 렌더하지 않는다.
 * - 설명 줄 = evidence 근거 문구(있을 때만). 없으면 사실 그대로의 고정 문구.
 */
export function WikiFound({
  tags,
  myInterests,
  onAdded,
}: {
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
  onAdded: () => void;
}) {
  if (tags.status !== "success" || myInterests === null) return null;

  const owned = new Set(myInterests.map((interest) => normalizeName(interest.name)));
  const candidates = tags.data.filter((tag) => !owned.has(normalizeName(tag.tag))).slice(0, FOUND_LIMIT);
  if (candidates.length === 0) return null;

  return (
    <section aria-label="AI가 최근 발견한 관심사" className="mb-8">
      <h2 className="mb-2.5 flex items-baseline gap-2 text-[17px] font-bold tracking-[-0.01em] text-foreground">
        AI가 최근 발견한 관심사
        <span className="text-[12px] font-semibold text-muted-foreground">{candidates.length}건</span>
      </h2>
      <div className="flex flex-col gap-2.5">
        {candidates.map((tag) => (
          <FoundRow key={tag.tagId} tag={tag} onAdded={onAdded} />
        ))}
      </div>
    </section>
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function FoundRow({ tag, onAdded }: { tag: WikiTag; onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function add() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    createInterest(tag.tag.trim())
      .then(() => onAdded())
      .catch((err) => {
        // 이미 등록돼 있으면 목표 상태 달성 — 성공과 동일하게 목록을 다시 읽어 정합시킨다.
        if (err instanceof ApiError && err.code === ERROR_CODES.DUPLICATE_RESOURCE) {
          onAdded();
          return;
        }
        setFailed(true);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-[18px] py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-foreground">{tag.tag}</div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {tag.reasonMessages[0] ?? "최근 저장한 자료에서 반복해서 나타난 주제예요."}
        </div>
        {failed && (
          <div role="alert" className="mt-1 text-[12px] text-signal-ink">
            추가하지 못했어요. 다시 시도해 주세요.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        aria-busy={busy}
        className="focus-ring inline-flex shrink-0 items-center justify-center rounded-[10px] border border-primary bg-primary px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96] disabled:opacity-50"
      >
        ＋ 추가
      </button>
    </div>
  );
}
