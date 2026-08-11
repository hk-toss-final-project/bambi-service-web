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
 *
 * <b>레이아웃 = 칩(2026-08-11 우석).</b> 후보 12건을 세로 카드로 세우니 화면을 통째로 먹고
 * 스크롤이 길어졌다(실사용 확인). 온디맨드 패널의 관심사 칩과 같은 형태로 압축한다 —
 * 칩 하나가 곧 "＋ 추가" 버튼이고, 카드마다 반복되던 동일 설명 문구는 섹션 안내 한 줄로 올린다.
 * 근거 문구(evidence)는 title 로 남겨 마우스를 올리면 볼 수 있게 한다(정보 유실 없음).
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
    // 카드 박스로 묶는다(2026-08-11 우석) — 온디맨드 패널(.on-demand-panel)과 같은
    // rounded-[14px] border bg-card 컨테이너. 칩만 배경 없이 떠 있으면 어디까지가 이 섹션인지
    // 경계가 안 보인다.
    <section
      aria-label="AI가 최근 발견한 관심사"
      className="mb-8 rounded-[14px] border border-border bg-card px-[18px] py-4"
    >
      <h2 className="flex items-baseline gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
        AI가 최근 발견한 관심사
        <span className="text-[12px] font-semibold text-muted-foreground">{candidates.length}건</span>
      </h2>
      <p className="mt-1 mb-3 text-[12.5px] leading-[1.6] text-muted-foreground">
        저장한 자료에서 반복해 나타난 주제예요. 누르면 내 관심사로 추가돼요.
      </p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((tag) => (
          <FoundChip key={tag.tagId} tag={tag} onAdded={onAdded} />
        ))}
      </div>
    </section>
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 후보 칩 — 칩 자체가 "＋ 추가" 버튼이다(온디맨드 패널 관심사 칩과 같은 형태).
 * 실패는 칩 옆이 아니라 칩 문구로 알린다 — 칩 사이에 빨간 줄이 끼면 배치가 무너진다.
 */
function FoundChip({ tag, onAdded }: { tag: WikiTag; onAdded: () => void }) {
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
    <button
      type="button"
      onClick={add}
      disabled={busy}
      aria-busy={busy}
      // 근거 문구는 칩에 다 못 쓰므로 title 로 남긴다(정보 유실 없음).
      title={tag.reasonMessages[0] ?? undefined}
      aria-label={`${tag.tag} 내 관심사로 추가`}
      // 칩은 카드 배경 위에 놓이므로 bg-background 로 한 톤 낮춰 경계를 만든다(온디맨드 칩과 동일).
      className={`focus-ring inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-50 ${
        failed
          ? "border-destructive text-destructive"
          : "border-border bg-background text-foreground hover:border-primary hover:text-signal-ink"
      }`}
    >
      <span className="min-w-0 truncate">{failed ? "추가 실패 — 다시" : tag.tag}</span>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground">
        ＋
      </span>
    </button>
  );
}
